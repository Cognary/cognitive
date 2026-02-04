/**
 * OpenAI Provider - OpenAI API (and compatible APIs)
 * v2.5: Added streaming and multimodal (vision) support
 */

import { BaseProviderV25 } from './base.js';
import type { 
  InvokeParams, 
  InvokeResult, 
  InvokeParamsV25, 
  StreamingInvokeResult,
  ModalityType,
  MediaInput
} from '../types.js';

// Type for OpenAI message content
type OpenAIContentPart = 
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenAIContentPart[];
};

export class OpenAIProvider extends BaseProviderV25 {
  name = 'openai';
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey?: string, model = 'gpt-4o', baseUrl = 'https://api.openai.com/v1') {
    super();
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.model = model;
    this.baseUrl = baseUrl;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Check if streaming is supported (always true for OpenAI)
   */
  supportsStreaming(): boolean {
    return true;
  }

  /**
   * Check multimodal support (vision models)
   */
  supportsMultimodal(): { input: ModalityType[]; output: ModalityType[] } {
    // Vision models support image input
    const visionModels = ['gpt-4o', 'gpt-4-vision', 'gpt-4-turbo', 'gpt-4o-mini'];
    const supportsVision = visionModels.some(m => this.model.includes(m));
    
    return {
      input: supportsVision ? ['text', 'image'] : ['text'],
      output: ['text'] // DALL-E would be separate
    };
  }

  async invoke(params: InvokeParams): Promise<InvokeResult> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY environment variable.');
    }

    const url = `${this.baseUrl}/chat/completions`;

    const body: Record<string, unknown> = {
      model: this.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 4096,
    };

    // Add JSON mode if schema provided
    if (params.jsonSchema) {
      body.response_format = { type: 'json_object' };
      // Append schema instruction to last user message
      const lastUserIdx = params.messages.findLastIndex(m => m.role === 'user');
      if (lastUserIdx >= 0) {
        const messages = [...params.messages];
        messages[lastUserIdx] = {
          ...messages[lastUserIdx],
          content: messages[lastUserIdx].content + this.buildJsonPrompt(params.jsonSchema),
        };
        body.messages = messages;
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    
    const content = data.choices?.[0]?.message?.content || '';
    
    return {
      content,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || 0,
      } : undefined,
    };
  }

  /**
   * Invoke with streaming response
   */
  async invokeStream(params: InvokeParamsV25): Promise<StreamingInvokeResult> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY environment variable.');
    }

    const url = `${this.baseUrl}/chat/completions`;

    // Build messages with multimodal content if present
    const messages = this.buildMessagesWithMedia(params);

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 4096,
      stream: true,
    };

    // Add JSON mode if schema provided
    if (params.jsonSchema) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const bodyReader = response.body?.getReader();
    if (!bodyReader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;

    // Capture reader reference for closure
    const reader = bodyReader;

    // Create async generator for streaming
    async function* streamGenerator(): AsyncIterable<string> {
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Parse SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              return;
            }
            
            try {
              const parsed = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>;
                usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
              };
              
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
              
              // Capture usage if available
              if (parsed.usage) {
                usage = {
                  promptTokens: parsed.usage.prompt_tokens || 0,
                  completionTokens: parsed.usage.completion_tokens || 0,
                  totalTokens: parsed.usage.total_tokens || 0,
                };
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    }

    return {
      stream: streamGenerator(),
      usage
    };
  }

  /**
   * Build messages with multimodal content (images)
   */
  private buildMessagesWithMedia(params: InvokeParamsV25): OpenAIMessage[] {
    const hasImages = params.images && params.images.length > 0;
    
    if (!hasImages) {
      return params.messages;
    }
    
    // Find the last user message and add images to it
    const messages: OpenAIMessage[] = [];
    const lastUserIdx = params.messages.findLastIndex(m => m.role === 'user');
    
    for (let i = 0; i < params.messages.length; i++) {
      const msg = params.messages[i];
      
      if (i === lastUserIdx && hasImages) {
        // Convert to multimodal content
        const content: OpenAIContentPart[] = [
          { type: 'text', text: msg.content }
        ];
        
        // Add images
        for (const img of params.images!) {
          const imageUrl = this.mediaInputToUrl(img);
          if (imageUrl) {
            content.push({
              type: 'image_url',
              image_url: { url: imageUrl, detail: 'auto' }
            });
          }
        }
        
        messages.push({ role: msg.role, content });
      } else {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    
    // Add JSON schema instruction if needed
    if (params.jsonSchema && lastUserIdx >= 0) {
      const lastMsg = messages[lastUserIdx];
      if (typeof lastMsg.content === 'string') {
        lastMsg.content = lastMsg.content + this.buildJsonPrompt(params.jsonSchema);
      } else {
        // Content is array, append to text part
        const textPart = lastMsg.content.find(p => p.type === 'text');
        if (textPart && textPart.type === 'text') {
          textPart.text = textPart.text + this.buildJsonPrompt(params.jsonSchema);
        }
      }
    }
    
    return messages;
  }

  /**
   * Convert MediaInput to URL for OpenAI API
   */
  private mediaInputToUrl(media: MediaInput): string | null {
    switch (media.type) {
      case 'url':
        return media.url;
      case 'base64':
        return `data:${media.media_type};base64,${media.data}`;
      case 'file':
        // File paths would need to be loaded first
        // This should be handled by the runner before calling the provider
        console.warn('[cognitive] File media input not pre-loaded, skipping');
        return null;
      default:
        return null;
    }
  }
}
