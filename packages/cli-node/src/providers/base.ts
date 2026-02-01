/**
 * Base Provider - Abstract class for all LLM providers
 */

import type { Provider, InvokeParams, InvokeResult } from '../types.js';

export abstract class BaseProvider implements Provider {
  abstract name: string;
  
  abstract invoke(params: InvokeParams): Promise<InvokeResult>;
  
  abstract isConfigured(): boolean;

  protected buildJsonPrompt(schema: object): string {
    return `\n\nYou MUST respond with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}\n\nRespond with ONLY the JSON, no markdown code blocks.`;
  }

  protected parseJsonResponse(content: string): unknown {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;
    
    try {
      return JSON.parse(jsonStr.trim());
    } catch {
      throw new Error(`Failed to parse JSON response: ${content.substring(0, 200)}`);
    }
  }
}
