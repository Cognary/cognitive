/**
 * Moonshot Provider - Moonshot AI (Kimi) API
 */

import { BaseProvider } from './base.js';
import type { InvokeParams, InvokeResult } from '../types.js';

export class MoonshotProvider extends BaseProvider {
  name = 'moonshot';
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://api.moonshot.cn/v1';

  constructor(apiKey?: string, model = 'kimi-k2.5') {
    super();
    this.apiKey = apiKey || process.env.MOONSHOT_API_KEY || '';
    this.model = model;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private buildRequestBody(params: InvokeParams): Record<string, unknown> {
    // Moonshot (Kimi) model-specific constraints:
    // - Some Kimi models reject arbitrary temperatures (e.g. `kimi-k2.5` only allows 1).
    const model = this.model;
    let temperature = params.temperature ?? 0.7;
    if (model === 'kimi-k2.5') temperature = 1;

    const body: Record<string, unknown> = {
      model,
      messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature,
      max_tokens: params.maxTokens ?? 4096,
    };

    // Add JSON mode if schema provided
    if (params.jsonSchema) {
      body.response_format = { type: 'json_object' };
      const lastUserIdx = params.messages.findLastIndex((m) => m.role === 'user');
      if (lastUserIdx >= 0) {
        const messages = [...params.messages];
        messages[lastUserIdx] = {
          ...messages[lastUserIdx],
          content: messages[lastUserIdx].content + this.buildJsonPrompt(params.jsonSchema),
        };
        body.messages = messages.map((m) => ({ role: m.role, content: m.content }));
      }
    }

    return body;
  }

  async invoke(params: InvokeParams): Promise<InvokeResult> {
    if (!this.isConfigured()) {
      throw new Error('Moonshot API key not configured. Set MOONSHOT_API_KEY environment variable.');
    }

    const url = `${this.baseUrl}/chat/completions`;

    const body = this.buildRequestBody(params);

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
      throw new Error(`Moonshot API error: ${response.status} - ${error}`);
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
