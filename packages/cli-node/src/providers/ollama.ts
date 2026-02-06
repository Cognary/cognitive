/**
 * Ollama Provider - Local LLM via Ollama
 * 
 * Supports both streaming and non-streaming invocation.
 */

import { BaseProvider } from './base.js';
import type { InvokeParams, InvokeResult } from '../types.js';

export class OllamaProvider extends BaseProvider {
  name = 'ollama';
  private model: string;
  private baseUrl: string;

  constructor(model = 'llama4', baseUrl = 'http://localhost:11434') {
    super();
    this.model = process.env.OLLAMA_MODEL || model;
    this.baseUrl = process.env.OLLAMA_HOST || baseUrl;
  }

  isConfigured(): boolean {
    return true; // Ollama doesn't need API key
  }

  /**
   * Ollama supports streaming.
   */
  supportsStreaming(): boolean {
    return true;
  }

  /**
   * Build request body for Ollama API
   */
  private buildRequestBody(params: InvokeParams, stream: boolean): Record<string, unknown> {
    let messages = params.messages.map(m => ({ role: m.role, content: m.content }));

    // Add JSON mode if schema provided
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
      messages,
      stream,
      options: {
        temperature: params.temperature ?? 0.7,
        num_predict: params.maxTokens ?? 4096,
      },
    };

    // Request JSON format
    if (params.jsonSchema) {
      body.format = 'json';
    }

    return body;
  }

  async invoke(params: InvokeParams): Promise<InvokeResult> {
    const url = `${this.baseUrl}/api/chat`;
    const body = this.buildRequestBody(params, false);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };
    
    const content = data.message?.content || '';
    
    return {
      content,
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
    };
  }

  /**
   * Stream-based invoke using Ollama's streaming API.
   * Yields content chunks as they arrive from the API.
   */
  async *invokeStream(params: InvokeParams): AsyncGenerator<string, InvokeResult, unknown> {
    const url = `${this.baseUrl}/api/chat`;
    const body = this.buildRequestBody(params, true);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    if (!response.body) {
      throw new Error('Ollama API returned no body for streaming request');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const collectedChunks: string[] = [];
    let promptTokens = 0;
    let completionTokens = 0;
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines from the buffer (NDJSON format)
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          try {
            const data = JSON.parse(trimmed) as {
              message?: { content?: string };
              done?: boolean;
              prompt_eval_count?: number;
              eval_count?: number;
            };
            
            // Extract content chunk
            const content = data.message?.content;
            if (content) {
              collectedChunks.push(content);
              yield content;
            }
            
            // Extract usage info (in the final message when done=true)
            if (data.done) {
              promptTokens = data.prompt_eval_count || 0;
              completionTokens = data.eval_count || 0;
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }

      // Flush decoder and process trailing buffered data even without trailing newline.
      buffer += decoder.decode();
      for (const line of buffer.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const data = JSON.parse(trimmed) as {
            message?: { content?: string };
            done?: boolean;
            prompt_eval_count?: number;
            eval_count?: number;
          };

          const content = data.message?.content;
          if (content) {
            collectedChunks.push(content);
            yield content;
          }

          if (data.done) {
            promptTokens = data.prompt_eval_count || 0;
            completionTokens = data.eval_count || 0;
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    } finally {
      reader.releaseLock();
    }

    const fullContent = collectedChunks.join('');
    return {
      content: fullContent,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }
}
