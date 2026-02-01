/**
 * Gemini Provider - Google Gemini API
 */

import { BaseProvider } from './base.js';
import type { InvokeParams, InvokeResult } from '../types.js';

export class GeminiProvider extends BaseProvider {
  name = 'gemini';
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey?: string, model = 'gemini-3-flash') {
    super();
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    this.model = model;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
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

  async invoke(params: InvokeParams): Promise<InvokeResult> {
    if (!this.isConfigured()) {
      throw new Error('Gemini API key not configured. Set GEMINI_API_KEY environment variable.');
    }

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    // Convert messages to Gemini format
    const contents = params.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    // Add system instruction if present
    const systemMessage = params.messages.find(m => m.role === 'system');
    
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

    // Add JSON schema constraint if provided
    if (params.jsonSchema) {
      const cleanedSchema = this.cleanSchemaForGemini(params.jsonSchema);
      body.generationConfig = {
        ...body.generationConfig as object,
        responseMimeType: 'application/json',
        responseSchema: cleanedSchema,
      };
    }

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
}
