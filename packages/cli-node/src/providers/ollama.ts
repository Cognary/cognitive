/**
 * Ollama Provider - Local LLM via Ollama
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

  async invoke(params: InvokeParams): Promise<InvokeResult> {
    const url = `${this.baseUrl}/api/chat`;

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
      stream: false,
      options: {
        temperature: params.temperature ?? 0.7,
        num_predict: params.maxTokens ?? 4096,
      },
    };

    // Request JSON format
    if (params.jsonSchema) {
      body.format = 'json';
    }

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
}
