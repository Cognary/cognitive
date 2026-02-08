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

  private buildRequestBody(params: InvokeParams, overrides?: { temperature?: number }): Record<string, unknown> {
    // Moonshot (Kimi) model-specific constraints:
    // - Some Kimi models reject arbitrary temperatures (e.g. `kimi-k2.5` only allows 1).
    const model = this.model;
    let temperature = overrides?.temperature ?? params.temperature ?? 0.7;
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

  private parseRequiredTemperature(errorText: string): number | null {
    const s = String(errorText ?? '');
    // Example: {"error":{"message":"invalid temperature: only 1 is allowed for this model","type":"invalid_request_error"}}
    // Also tolerate plain text.
    const m = s.match(/invalid temperature[^0-9]*only\s+([0-9]+(?:\.[0-9]+)?)\s+is allowed/i);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) return n;
    }
    // Some variants omit "only" but still contain a single allowed value.
    const m2 = s.match(/invalid temperature[^0-9]*([0-9]+(?:\.[0-9]+)?)\s+is allowed/i);
    if (m2?.[1]) {
      const n = Number(m2[1]);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  private async fetchOnce(body: Record<string, unknown>): Promise<Response> {
    const url = `${this.baseUrl}/chat/completions`;
    return await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  }

  async invoke(params: InvokeParams): Promise<InvokeResult> {
    if (!this.isConfigured()) {
      throw new Error('Moonshot API key not configured. Set MOONSHOT_API_KEY environment variable.');
    }

    // Moonshot is strict about some generation params for certain models.
    // Keep UX stable: if we hit a known parameter-compat error, retry once with a safer value.
    const initialBody = this.buildRequestBody(params);

    let response = await this.fetchOnce(initialBody);

    if (!response.ok) {
      const errorText = await response.text();
      const requiredTemp = this.parseRequiredTemperature(errorText);
      if (response.status === 400 && requiredTemp !== null) {
        const retryBody = this.buildRequestBody(params, { temperature: requiredTemp });
        response = await this.fetchOnce(retryBody);
        if (!response.ok) {
          const retryError = await response.text();
          throw new Error(`Moonshot API error: ${response.status} - ${retryError}`);
        }
      } else {
        throw new Error(`Moonshot API error: ${response.status} - ${errorText}`);
      }
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
