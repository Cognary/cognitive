/**
 * OpenAI Provider - OpenAI API (and compatible APIs)
 */

import { BaseProvider } from './base.js';
import type { InvokeParams, InvokeResult } from '../types.js';

export class OpenAIProvider extends BaseProvider {
  name = 'openai';
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey?: string, model = 'gpt-5.2', baseUrl = 'https://api.openai.com/v1') {
    super();
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.model = model;
    this.baseUrl = baseUrl;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
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
}
