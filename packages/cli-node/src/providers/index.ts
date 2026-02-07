/**
 * Provider Registry
 *
 * Publish-grade note:
 * Providers expose a small capability surface (structured output, streaming).
 * The runner uses this to decide whether to pass native schemas or prompt-only guidance.
 */

import type { Provider, ProviderCapabilities, StructuredOutputMode } from '../types.js';
import { GeminiProvider } from './gemini.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { MiniMaxProvider } from './minimax.js';
import { DeepSeekProvider } from './deepseek.js';
import { MoonshotProvider } from './moonshot.js';
import { QwenProvider } from './qwen.js';
import { OllamaProvider } from './ollama.js';

export { BaseProvider } from './base.js';
export { GeminiProvider } from './gemini.js';
export { OpenAIProvider } from './openai.js';
export { AnthropicProvider } from './anthropic.js';
export { MiniMaxProvider } from './minimax.js';
export { DeepSeekProvider } from './deepseek.js';
export { MoonshotProvider } from './moonshot.js';
export { QwenProvider } from './qwen.js';
export { OllamaProvider } from './ollama.js';

type ProviderFactory = (model?: string) => Provider;

const providers: Record<string, ProviderFactory> = {
  gemini: (model) => new GeminiProvider(undefined, model),
  openai: (model) => new OpenAIProvider(undefined, model),
  anthropic: (model) => new AnthropicProvider(undefined, model),
  minimax: (model) => new MiniMaxProvider(undefined, model),
  deepseek: (model) => new DeepSeekProvider(undefined, model),
  moonshot: (model) => new MoonshotProvider(undefined, model),
  kimi: (model) => new MoonshotProvider(undefined, model), // Alias
  qwen: (model) => new QwenProvider(undefined, model),
  tongyi: (model) => new QwenProvider(undefined, model), // Alias
  dashscope: (model) => new QwenProvider(undefined, model), // Alias
  ollama: (model) => new OllamaProvider(model),
  local: (model) => new OllamaProvider(model), // Alias
};

export function getProvider(name?: string, model?: string): Provider {
  // Check for model override from environment
  const modelOverride = model || process.env.COG_MODEL;

  // Auto-detect if not specified
  if (!name) {
    if (process.env.GEMINI_API_KEY) return new GeminiProvider(undefined, modelOverride);
    if (process.env.OPENAI_API_KEY) return new OpenAIProvider(undefined, modelOverride);
    if (process.env.ANTHROPIC_API_KEY) return new AnthropicProvider(undefined, modelOverride);
    if (process.env.DEEPSEEK_API_KEY) return new DeepSeekProvider(undefined, modelOverride);
    if (process.env.MINIMAX_API_KEY) return new MiniMaxProvider(undefined, modelOverride);
    if (process.env.MOONSHOT_API_KEY) return new MoonshotProvider(undefined, modelOverride);
    if (process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY) return new QwenProvider(undefined, modelOverride);
    // Ollama is always available as fallback if nothing else is configured
    return new OllamaProvider(modelOverride);
  }

  const factory = providers[name.toLowerCase()];
  if (!factory) {
    throw new Error(`Unknown provider: ${name}. Available: ${Object.keys(providers).join(', ')}`);
  }

  return factory(modelOverride);
}

function safeCapabilities(p: Provider): ProviderCapabilities {
  const caps = p.getCapabilities?.();
  if (caps) return caps;
  return { structuredOutput: 'prompt', streaming: p.supportsStreaming?.() ?? false };
}

function providerRow(
  name: string,
  configured: boolean,
  model: string,
  make: () => Provider
): { name: string; configured: boolean; model: string; structuredOutput: StructuredOutputMode; streaming: boolean } {
  const caps = safeCapabilities(make());
  return { name, configured, model, structuredOutput: caps.structuredOutput, streaming: caps.streaming };
}

export function listProviders(): Array<{ name: string; configured: boolean; model: string; structuredOutput: StructuredOutputMode; streaming: boolean }> {
  return [
    providerRow('gemini', !!process.env.GEMINI_API_KEY, 'gemini-3-flash', () => new GeminiProvider('')),
    providerRow('openai', !!process.env.OPENAI_API_KEY, 'gpt-5.2', () => new OpenAIProvider('')),
    providerRow('anthropic', !!process.env.ANTHROPIC_API_KEY, 'claude-sonnet-4.5', () => new AnthropicProvider('')),
    providerRow('deepseek', !!process.env.DEEPSEEK_API_KEY, 'deepseek-v3.2', () => new DeepSeekProvider('')),
    providerRow('minimax', !!process.env.MINIMAX_API_KEY, 'MiniMax-M2.1', () => new MiniMaxProvider('')),
    providerRow('moonshot', !!process.env.MOONSHOT_API_KEY, 'kimi-k2.5', () => new MoonshotProvider('')),
    providerRow('qwen', !!(process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY), 'qwen3-max', () => new QwenProvider('')),
    providerRow('ollama', true, 'llama4 (local)', () => new OllamaProvider()),
  ];
}
