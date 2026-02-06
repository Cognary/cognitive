/**
 * Anthropic Provider - Claude API
 * 
 * Supports both streaming and non-streaming invocation.
 */

import { BaseProvider } from './base.js';
import type { InvokeParams, InvokeResult } from '../types.js';

export class AnthropicProvider extends BaseProvider {
  name = 'anthropic';
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://api.anthropic.com/v1';

  constructor(apiKey?: string, model = 'claude-sonnet-4-5-20250929') {
    super();
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.model = model;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Anthropic supports streaming.
   */
  supportsStreaming(): boolean {
    return true;
  }

  /**
   * Build request body for Anthropic API
   */
  private buildRequestBody(params: InvokeParams, stream: boolean): { body: Record<string, unknown>; systemContent: string | undefined } {
    // Extract system message
    const systemMessage = params.messages.find(m => m.role === 'system');
    const otherMessages = params.messages.filter(m => m.role !== 'system');

    // Add JSON schema instruction if provided
    let messages = otherMessages;
    if (params.jsonSchema) {
      const lastUserIdx = messages.findLastIndex(m => m.role === 'user');
      if (lastUserIdx >= 0) {
        messages = [...messages];
        messages[lastUserIdx] = {
          ...messages[lastUserIdx],
          content: messages[lastUserIdx].content + this.buildJsonPrompt(params.jsonSchema),
        };
      }
    }

    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: params.maxTokens ?? 4096,
      stream,
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    return { body, systemContent: systemMessage?.content };
  }

  async invoke(params: InvokeParams): Promise<InvokeResult> {
    if (!this.isConfigured()) {
      throw new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.');
    }

    const url = `${this.baseUrl}/messages`;
    const { body } = this.buildRequestBody(params, false);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      content?: Array<{ text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    
    const content = data.content?.[0]?.text || '';
    
    return {
      content,
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens || 0,
        completionTokens: data.usage.output_tokens || 0,
        totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
      } : undefined,
    };
  }

  /**
   * Stream-based invoke using Anthropic's streaming API.
   * Yields content chunks as they arrive from the API.
   */
  async *invokeStream(params: InvokeParams): AsyncGenerator<string, InvokeResult, unknown> {
    if (!this.isConfigured()) {
      throw new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.');
    }

    const url = `${this.baseUrl}/messages`;
    const { body } = this.buildRequestBody(params, true);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    if (!response.body) {
      throw new Error('Anthropic API returned no body for streaming request');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const collectedChunks: string[] = [];
    let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines from the buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue; // Skip empty lines and comments
          
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6)) as {
                type?: string;
                delta?: { type?: string; text?: string };
                message?: { usage?: { input_tokens?: number; output_tokens?: number } };
                usage?: { input_tokens?: number; output_tokens?: number };
              };
              
              // Extract content chunk (content_block_delta event)
              if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
                const text = data.delta.text || '';
                if (text) {
                  collectedChunks.push(text);
                  yield text;
                }
              }
              
              // Extract usage info (message_delta or message_stop event)
              if (data.type === 'message_delta' && data.usage) {
                usage = {
                  promptTokens: data.usage.input_tokens || 0,
                  completionTokens: data.usage.output_tokens || 0,
                  totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
                };
              }
              
              // Also check message_start for input tokens
              if (data.type === 'message_start' && data.message?.usage) {
                const inputTokens = data.message.usage.input_tokens || 0;
                usage = {
                  promptTokens: inputTokens,
                  completionTokens: usage?.completionTokens || 0,
                  totalTokens: inputTokens + (usage?.completionTokens || 0),
                };
              }
            } catch {
              // Skip invalid JSON chunks
            }
          }
        }
      }

      // Flush decoder and process trailing buffered data even without trailing newline.
      buffer += decoder.decode();
      for (const line of buffer.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6)) as {
              type?: string;
              delta?: { type?: string; text?: string };
              message?: { usage?: { input_tokens?: number; output_tokens?: number } };
              usage?: { input_tokens?: number; output_tokens?: number };
            };

            if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
              const text = data.delta.text || '';
              if (text) {
                collectedChunks.push(text);
                yield text;
              }
            }

            if (data.type === 'message_delta' && data.usage) {
              usage = {
                promptTokens: data.usage.input_tokens || 0,
                completionTokens: data.usage.output_tokens || 0,
                totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
              };
            }

            if (data.type === 'message_start' && data.message?.usage) {
              const inputTokens = data.message.usage.input_tokens || 0;
              usage = {
                promptTokens: inputTokens,
                completionTokens: usage?.completionTokens || 0,
                totalTokens: inputTokens + (usage?.completionTokens || 0),
              };
            }
          } catch {
            // Skip invalid JSON chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const fullContent = collectedChunks.join('');
    return {
      content: fullContent,
      usage,
    };
  }
}
