/**
 * Provider Registry
 */

import type { Provider } from '../types.js';
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

export function listProviders(): Array<{ name: string; configured: boolean; model: string }> {
  return [
    { name: 'gemini', configured: !!process.env.GEMINI_API_KEY, model: 'gemini-3-flash' },
    { name: 'openai', configured: !!process.env.OPENAI_API_KEY, model: 'gpt-5.2' },
    { name: 'anthropic', configured: !!process.env.ANTHROPIC_API_KEY, model: 'claude-sonnet-4.5' },
    { name: 'deepseek', configured: !!process.env.DEEPSEEK_API_KEY, model: 'deepseek-v3.2' },
    { name: 'minimax', configured: !!process.env.MINIMAX_API_KEY, model: 'MiniMax-M2.1' },
    { name: 'moonshot', configured: !!process.env.MOONSHOT_API_KEY, model: 'kimi-k2.5' },
    { name: 'qwen', configured: !!(process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY), model: 'qwen3-max' },
    { name: 'ollama', configured: true, model: 'llama4 (local)' },
  ];
}
