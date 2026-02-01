/**
 * Anthropic Provider - Claude API
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

  async invoke(params: InvokeParams): Promise<InvokeResult> {
    if (!this.isConfigured()) {
      throw new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.');
    }

    const url = `${this.baseUrl}/messages`;

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
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

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
}
