/**
 * Base Provider - Abstract class for all LLM providers
 * v2.5: Added streaming and multimodal support
 */

import type { 
  Provider, 
  InvokeParams, 
  InvokeResult,
  ProviderV25,
  InvokeParamsV25,
  StreamingInvokeResult,
  ModalityType
} from '../types.js';

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

/**
 * Base Provider with v2.5 streaming and multimodal support
 */
export abstract class BaseProviderV25 extends BaseProvider implements ProviderV25 {
  /**
   * Check if this provider supports streaming
   * Override in subclass to enable streaming
   */
  supportsStreaming(): boolean {
    return false;
  }
  
  /**
   * Check if this provider supports multimodal input/output
   * Override in subclass to enable multimodal
   */
  supportsMultimodal(): { input: ModalityType[]; output: ModalityType[] } {
    return {
      input: ['text'],
      output: ['text']
    };
  }
  
  /**
   * Invoke with streaming response
   * Override in subclass to implement streaming
   */
  async invokeStream(params: InvokeParamsV25): Promise<StreamingInvokeResult> {
    // Default: fallback to non-streaming with async generator wrapper
    const result = await this.invoke(params);
    
    async function* generateChunks(): AsyncIterable<string> {
      yield result.content;
    }
    
    return {
      stream: generateChunks(),
      usage: result.usage
    };
  }
  
  /**
   * Format media inputs for the specific provider API
   * Override in subclass for provider-specific formatting
   */
  protected formatMediaForProvider(
    images?: Array<{ type: string; url?: string; data?: string; media_type?: string }>,
    _audio?: Array<{ type: string; url?: string; data?: string; media_type?: string }>,
    _video?: Array<{ type: string; url?: string; data?: string; media_type?: string }>
  ): unknown[] {
    // Default implementation for image-only providers (like OpenAI Vision)
    if (!images || images.length === 0) {
      return [];
    }
    
    return images.map(img => {
      if (img.type === 'url' && img.url) {
        return {
          type: 'image_url',
          image_url: {
            url: img.url
          }
        };
      } else if (img.type === 'base64' && img.data && img.media_type) {
        return {
          type: 'image_url',
          image_url: {
            url: `data:${img.media_type};base64,${img.data}`
          }
        };
      }
      return null;
    }).filter(Boolean);
  }
}
