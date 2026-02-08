/**
 * Gemini Provider - Google Gemini API
 * 
 * Supports both streaming and non-streaming invocation.
 */

import { BaseProvider } from './base.js';
import type { InvokeParams, InvokeResult } from '../types.js';

export class GeminiProvider extends BaseProvider {
  name = 'gemini';
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  // Default model is intentionally overrideable via `--model`.
  // If this model is not available for a user's account/API version, they should pass an
  // explicit model id (or switch providers) rather than relying on implicit defaults.
  constructor(apiKey?: string, model = 'gemini-3-pro-preview') {
    super();
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    this.model = model;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Gemini supports streaming.
   */
  supportsStreaming(): boolean {
    return true;
  }

  getCapabilities() {
    // Gemini has a native response schema surface (generationConfig.responseSchema),
    // but it is NOT JSON Schema. The runner will treat this as "native but non-JSON-schema"
    // and will safely downgrade to prompt-guided JSON unless/ until a real dialect mapping exists.
    return {
      structuredOutput: 'native' as const,
      streaming: true,
      nativeSchemaDialect: 'gemini-responseSchema' as const,
    };
  }

  /**
   * Clean JSON Schema for Gemini API compatibility
   * Removes unsupported fields like additionalProperties
   */
  private cleanSchemaForGemini(schema: object): object {
    const unsupportedFields = ['additionalProperties', '$schema', 'default', 'examples'];
    
    const clean = (obj: unknown): unknown => {
      if (Array.isArray(obj)) {
        return obj.map(clean);
      }
      if (obj && typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
          // Gemini's responseSchema has a restricted schema subset.
          // In particular:
          // - `const` is not supported
          // - `enum` values appear to be string-only in the API surface
          if (key === 'const') {
            // Preserve type info as best-effort but drop the exact-value constraint.
            // (Core runtime will still validate/repair the envelope.)
            if (value === null) {
              // Leave unconstrained; null typing is not consistently supported.
            } else if (typeof value === 'boolean') {
              result.type = 'boolean';
            } else if (typeof value === 'number') {
              result.type = 'number';
            } else if (typeof value === 'string') {
              result.type = 'string';
              // String enums are supported, so we can keep a single-value constraint.
              result.enum = [value];
            }
            continue;
          }
          if (key === 'enum') {
            if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
              result.enum = value.map((v) => v);
            } else {
              // Drop non-string enums for Gemini compatibility.
            }
            continue;
          }
          if (!unsupportedFields.includes(key)) {
            result[key] = clean(value);
          }
        }
        return result;
      }
      return obj;
    };
    
    return clean(schema) as object;
  }

  /**
   * Build request body for Gemini API
   */
  private buildRequestBody(params: InvokeParams): Record<string, unknown> {
    // If the caller wants schema guidance but not native enforcement, inject the schema into the prompt.
    // (Gemini's native responseSchema supports only a restricted schema subset and can reject valid JSON Schema.)
    const mode = params.jsonSchemaMode ?? (params.jsonSchema ? 'prompt' : undefined);
    let messages = params.messages;
    if (params.jsonSchema && mode === 'prompt') {
      const lastUserIdx = messages.findLastIndex(m => m.role === 'user');
      if (lastUserIdx >= 0) {
        messages = [...messages];
        messages[lastUserIdx] = {
          ...messages[lastUserIdx],
          content: messages[lastUserIdx].content + this.buildJsonPrompt(params.jsonSchema),
        };
      }
    }

    // Convert messages to Gemini format
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    // Add system instruction if present
    const systemMessage = messages.find(m => m.role === 'system');
    
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: params.temperature ?? 0.7,
        maxOutputTokens: params.maxTokens ?? 8192,
      }
    };

    if (systemMessage) {
      body.systemInstruction = { parts: [{ text: systemMessage.content }] };
    }

    // Add JSON schema constraint if provided and caller requested native mode.
    if (params.jsonSchema && mode === 'native') {
      const cleanedSchema = this.cleanSchemaForGemini(params.jsonSchema);
      body.generationConfig = {
        ...body.generationConfig as object,
        responseMimeType: 'application/json',
        responseSchema: cleanedSchema,
      };
    }

    return body;
  }

  async invoke(params: InvokeParams): Promise<InvokeResult> {
    if (!this.isConfigured()) {
      throw new Error('Gemini API key not configured. Set GEMINI_API_KEY environment variable.');
    }

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
    const body = this.buildRequestBody(params);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    };
    
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return {
      content,
      usage: data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount || 0,
        completionTokens: data.usageMetadata.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata.totalTokenCount || 0,
      } : undefined,
    };
  }

  /**
   * Stream-based invoke using Gemini's streaming API.
   * Yields content chunks as they arrive from the API.
   */
  async *invokeStream(params: InvokeParams): AsyncGenerator<string, InvokeResult, unknown> {
    if (!this.isConfigured()) {
      throw new Error('Gemini API key not configured. Set GEMINI_API_KEY environment variable.');
    }

    // Use streamGenerateContent endpoint
    const url = `${this.baseUrl}/models/${this.model}:streamGenerateContent?key=${this.apiKey}&alt=sse`;
    const body = this.buildRequestBody(params);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    if (!response.body) {
      throw new Error('Gemini API returned no body for streaming request');
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
          if (!trimmed) continue;
          
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6)) as {
                candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
                usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
              };
              
              // Extract content chunk
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                collectedChunks.push(text);
                yield text;
              }
              
              // Extract usage info (usually in the last chunk)
              if (data.usageMetadata) {
                usage = {
                  promptTokens: data.usageMetadata.promptTokenCount || 0,
                  completionTokens: data.usageMetadata.candidatesTokenCount || 0,
                  totalTokens: data.usageMetadata.totalTokenCount || 0,
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
        if (!trimmed) continue;

        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6)) as {
              candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
              usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
            };

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              collectedChunks.push(text);
              yield text;
            }

            if (data.usageMetadata) {
              usage = {
                promptTokens: data.usageMetadata.promptTokenCount || 0,
                completionTokens: data.usageMetadata.candidatesTokenCount || 0,
                totalTokens: data.usageMetadata.totalTokenCount || 0,
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
