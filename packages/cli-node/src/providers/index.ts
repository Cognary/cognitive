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

export type ProviderSupportTier = 'stable' | 'experimental' | 'community';

// Public promise: these providers are the "supported surface" for the open-source npm runtime.
// Everything else is intentionally treated as experimental/community to reduce user confusion and
// avoid over-promising stability across a long tail of provider quirks.
const STABLE_PROVIDERS = ['openai', 'anthropic', 'gemini', 'minimax', 'deepseek', 'qwen'] as const;
type StableProviderName = (typeof STABLE_PROVIDERS)[number];

const EXPERIMENTAL_PROVIDERS = ['moonshot', 'ollama'] as const;
type ExperimentalProviderName = (typeof EXPERIMENTAL_PROVIDERS)[number];

function isStableProvider(name: string): name is StableProviderName {
  return (STABLE_PROVIDERS as readonly string[]).includes(name);
}

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

  // Auto-detect if not specified.
  //
  // Important: we only auto-select within the "stable" provider set.
  // Experimental/community providers can still be used, but require explicit `--provider`,
  // so users don't accidentally end up on a provider they didn't intend (or that isn't
  // part of the stable support promise).
  if (!name) {
    if (process.env.OPENAI_API_KEY) return new OpenAIProvider(undefined, modelOverride);
    if (process.env.ANTHROPIC_API_KEY) return new AnthropicProvider(undefined, modelOverride);
    if (process.env.GEMINI_API_KEY) return new GeminiProvider(undefined, modelOverride);
    if (process.env.MINIMAX_API_KEY) return new MiniMaxProvider(undefined, modelOverride);
    if (process.env.DEEPSEEK_API_KEY) return new DeepSeekProvider(undefined, modelOverride);
    if (process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY) return new QwenProvider(undefined, modelOverride);
    throw new Error(
      `No stable provider configured. Set one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, MINIMAX_API_KEY, DEEPSEEK_API_KEY, DASHSCOPE_API_KEY/QWEN_API_KEY. ` +
        `To use experimental providers, pass --provider (e.g. --provider moonshot).`
    );
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
  make: () => Provider,
  support: ProviderSupportTier
): {
  name: string;
  support: ProviderSupportTier;
  configured: boolean;
  model: string;
  structuredOutput: StructuredOutputMode;
  structuredJsonSchema: Exclude<StructuredOutputMode, 'native'> | 'native';
  nativeSchemaDialect?: string;
  maxNativeSchemaBytes?: number;
  streaming: boolean;
} {
  const caps = safeCapabilities(make());
  const structuredJsonSchema: Exclude<StructuredOutputMode, 'native'> | 'native' =
    caps.structuredOutput === 'native' && (caps.nativeSchemaDialect ?? 'json-schema') !== 'json-schema'
      ? 'prompt'
      : caps.structuredOutput;
  return {
    name,
    support,
    configured,
    model,
    structuredOutput: caps.structuredOutput,
    structuredJsonSchema,
    nativeSchemaDialect: caps.nativeSchemaDialect,
    maxNativeSchemaBytes: caps.maxNativeSchemaBytes,
    streaming: caps.streaming,
  };
}

export function listProviders(opts?: { all?: boolean }): Array<{
  name: string;
  support: ProviderSupportTier;
  configured: boolean;
  model: string;
  structuredOutput: StructuredOutputMode;
  structuredJsonSchema: Exclude<StructuredOutputMode, 'native'> | 'native';
  nativeSchemaDialect?: string;
  maxNativeSchemaBytes?: number;
  streaming: boolean;
}> {
  const stable = [
    providerRow('openai', !!process.env.OPENAI_API_KEY, 'gpt-5.2', () => new OpenAIProvider(''), 'stable'),
    providerRow('anthropic', !!process.env.ANTHROPIC_API_KEY, 'claude-sonnet-4.5', () => new AnthropicProvider(''), 'stable'),
    providerRow('gemini', !!process.env.GEMINI_API_KEY, 'gemini-3-pro-preview', () => new GeminiProvider(''), 'stable'),
    providerRow('minimax', !!process.env.MINIMAX_API_KEY, 'MiniMax-M2.1', () => new MiniMaxProvider(''), 'stable'),
    providerRow('deepseek', !!process.env.DEEPSEEK_API_KEY, 'deepseek-v3.2', () => new DeepSeekProvider(''), 'stable'),
    providerRow('qwen', !!(process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY), 'qwen3-max', () => new QwenProvider(''), 'stable'),
  ];

  if (!opts?.all) return stable;

  const experimental = [
    providerRow('moonshot', !!process.env.MOONSHOT_API_KEY, 'kimi-k2.5', () => new MoonshotProvider(''), 'experimental'),
    providerRow('ollama', !!process.env.OLLAMA_HOST, 'llama4 (local)', () => new OllamaProvider(), 'community'),
  ];

  return [...stable, ...experimental];
}
