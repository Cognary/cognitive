/**
 * Module Runner - Execute Cognitive Modules
 * v2.5: Streaming response and multimodal support
 */

import type { 
  Provider, 
  CognitiveModule, 
  ModuleResult, 
  ModuleResultV21,
  ModuleResultV22,
  Message, 
  ModuleInput,
  EnvelopeResponse,
  EnvelopeResponseV22,
  EnvelopeMeta,
  ModuleResultData,
  RiskLevel,
  RiskRule,
  // v2.5 types
  StreamingChunk,
  MetaChunk,
  DeltaChunk,
  FinalChunk,
  ErrorChunk,
  ProgressChunk,
  StreamingSession,
  MediaInput,
  ProviderV25,
  CognitiveModuleV25,
  ModalityType,
  RuntimeCapabilities
} from '../types.js';
import { 
  aggregateRisk, 
  isV22Envelope,
  isProviderV25,
  isModuleV25,
  moduleSupportsStreaming,
  moduleSupportsMultimodal,
  getModuleInputModalities,
  ErrorCodesV25,
  DEFAULT_RUNTIME_CAPABILITIES
} from '../types.js';
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname } from 'path';

export interface RunOptions {
  // Clean input (v2 style)
  input?: ModuleInput;
  
  // Legacy CLI args (v1 compatibility) - mapped to input.code or input.query
  args?: string;
  
  // Runtime options
  verbose?: boolean;
  
  // Force envelope format (default: auto-detect from module.output.envelope)
  useEnvelope?: boolean;
  
  // Force v2.2 format (default: auto-detect from module.tier)
  useV22?: boolean;
  
  // Enable repair pass for validation failures (default: true)
  enableRepair?: boolean;
}

// =============================================================================
// Repair Pass (v2.2)
// =============================================================================

/**
 * Attempt to repair envelope format issues without changing semantics.
 * 
 * Repairs (lossless only):
 * - Missing meta fields (fill with conservative defaults)
 * - Truncate explain if too long
 * - Trim whitespace from string fields
 * 
 * Does NOT repair:
 * - Invalid enum values (treated as validation failure)
 */
function repairEnvelope(
  response: Record<string, unknown>,
  riskRule: RiskRule = 'max_changes_risk',
  maxExplainLength: number = 280
): EnvelopeResponseV22<unknown> {
  const repaired = { ...response };
  
  // Ensure meta exists
  if (!repaired.meta || typeof repaired.meta !== 'object') {
    repaired.meta = {};
  }
  
  const meta = repaired.meta as Record<string, unknown>;
  const data = (repaired.data ?? {}) as Record<string, unknown>;
  
  // Repair confidence
  if (typeof meta.confidence !== 'number') {
    meta.confidence = (data.confidence as number) ?? 0.5;
  }
  meta.confidence = Math.max(0, Math.min(1, meta.confidence as number));
  
  // Repair risk using configurable aggregation rule
  if (!meta.risk) {
    meta.risk = aggregateRisk(data, riskRule);
  }
  // Trim whitespace only (lossless), validate is valid RiskLevel
  if (typeof meta.risk === 'string') {
    const trimmedRisk = meta.risk.trim().toLowerCase();
    const validRisks = ['none', 'low', 'medium', 'high'];
    meta.risk = validRisks.includes(trimmedRisk) ? trimmedRisk : 'medium';
  } else {
    meta.risk = 'medium'; // Default for invalid type
  }
  
  // Repair explain
  if (typeof meta.explain !== 'string') {
    const rationale = data.rationale as string | undefined;
    meta.explain = rationale ? String(rationale).slice(0, maxExplainLength) : 'No explanation provided';
  }
  // Trim whitespace (lossless)
  const explainStr = meta.explain as string;
  meta.explain = explainStr.trim();
  if ((meta.explain as string).length > maxExplainLength) {
    meta.explain = (meta.explain as string).slice(0, maxExplainLength - 3) + '...';
  }
  
  // Build proper v2.2 response
  const builtMeta: EnvelopeMeta = {
    confidence: meta.confidence as number,
    risk: meta.risk as RiskLevel,
    explain: meta.explain as string
  };
  
  const result: EnvelopeResponseV22<unknown> = repaired.ok === false ? {
    ok: false,
    meta: builtMeta,
    error: (repaired.error as { code: string; message: string }) ?? { code: 'UNKNOWN', message: 'Unknown error' },
    partial_data: repaired.partial_data
  } : {
    ok: true,
    meta: builtMeta,
    data: repaired.data
  };
  
  return result;
}

/**
 * Wrap v2.1 response to v2.2 format
 */
function wrapV21ToV22(
  response: EnvelopeResponse<unknown>,
  riskRule: RiskRule = 'max_changes_risk'
): EnvelopeResponseV22<unknown> {
  if (isV22Envelope(response)) {
    return response;
  }
  
  if (response.ok) {
    const data = (response.data ?? {}) as Record<string, unknown>;
    const confidence = (data.confidence as number) ?? 0.5;
    const rationale = (data.rationale as string) ?? '';
    
    return {
      ok: true,
      meta: {
        confidence,
        risk: aggregateRisk(data, riskRule),
        explain: rationale.slice(0, 280) || 'No explanation provided'
      },
      data: data as ModuleResultData
    };
  } else {
    const errorMsg = response.error?.message ?? 'Unknown error';
    return {
      ok: false,
      meta: {
        confidence: 0,
        risk: 'high',
        explain: errorMsg.slice(0, 280)
      },
      error: response.error ?? { code: 'UNKNOWN', message: errorMsg },
      partial_data: response.partial_data
    };
  }
}

export async function runModule(
  module: CognitiveModule,
  provider: Provider,
  options: RunOptions = {}
): Promise<ModuleResult> {
  const { args, input, verbose = false, useEnvelope, useV22, enableRepair = true } = options;

  // Determine if we should use envelope format
  const shouldUseEnvelope = useEnvelope ?? (module.output?.envelope === true || module.format === 'v2');
  
  // Determine if we should use v2.2 format
  const isV22Module = module.tier !== undefined || module.formatVersion === 'v2.2';
  const shouldUseV22 = useV22 ?? (isV22Module || module.compat?.runtime_auto_wrap === true);
  
  // Get risk_rule from module config
  const riskRule: RiskRule = module.metaConfig?.risk_rule ?? 'max_changes_risk';

  // Build clean input data (v2 style: no $ARGUMENTS pollution)
  const inputData: ModuleInput = input || {};
  
  // Map legacy --args to clean input
  if (args && !inputData.code && !inputData.query) {
    // Determine if args looks like code or natural language
    if (looksLikeCode(args)) {
      inputData.code = args;
    } else {
      inputData.query = args;
    }
  }

  // Build prompt with clean substitution
  const prompt = buildPrompt(module, inputData);

  if (verbose) {
    console.error('--- Module ---');
    console.error(`Name: ${module.name} (${module.format})`);
    console.error(`Responsibility: ${module.responsibility}`);
    console.error(`Envelope: ${shouldUseEnvelope}`);
    console.error('--- Input ---');
    console.error(JSON.stringify(inputData, null, 2));
    console.error('--- Prompt ---');
    console.error(prompt);
    console.error('--- End ---');
  }

  // Build system message based on module config
  const systemParts: string[] = [
    `You are executing the "${module.name}" Cognitive Module.`,
    '',
    `RESPONSIBILITY: ${module.responsibility}`,
  ];

  if (module.excludes.length > 0) {
    systemParts.push('', 'YOU MUST NOT:');
    module.excludes.forEach(e => systemParts.push(`- ${e}`));
  }

  if (module.constraints) {
    systemParts.push('', 'CONSTRAINTS:');
    if (module.constraints.no_network) systemParts.push('- No network access');
    if (module.constraints.no_side_effects) systemParts.push('- No side effects');
    if (module.constraints.no_file_write) systemParts.push('- No file writes');
    if (module.constraints.no_inventing_data) systemParts.push('- Do not invent data');
  }

  if (module.output?.require_behavior_equivalence) {
    systemParts.push('', 'BEHAVIOR EQUIVALENCE:');
    systemParts.push('- You MUST set behavior_equivalence=true ONLY if the output is functionally identical');
    systemParts.push('- If unsure, set behavior_equivalence=false and explain in rationale');
    
    const maxConfidence = module.constraints?.behavior_equivalence_false_max_confidence ?? 0.7;
    systemParts.push(`- If behavior_equivalence=false, confidence MUST be <= ${maxConfidence}`);
  }

  // Add envelope format instructions
  if (shouldUseEnvelope) {
    if (shouldUseV22) {
      systemParts.push('', 'RESPONSE FORMAT (Envelope v2.2):');
      systemParts.push('- Wrap your response in the v2.2 envelope format with separate meta and data');
      systemParts.push('- Success: { "ok": true, "meta": { "confidence": 0.9, "risk": "low", "explain": "short summary" }, "data": { ...payload... } }');
      systemParts.push('- Error: { "ok": false, "meta": { "confidence": 0.0, "risk": "high", "explain": "error summary" }, "error": { "code": "ERROR_CODE", "message": "..." } }');
      systemParts.push('- meta.explain must be ≤280 characters. data.rationale can be longer for detailed reasoning.');
      systemParts.push('- meta.risk must be one of: "none", "low", "medium", "high"');
    } else {
      systemParts.push('', 'RESPONSE FORMAT (Envelope):');
      systemParts.push('- Wrap your response in the envelope format');
      systemParts.push('- Success: { "ok": true, "data": { ...your output... } }');
      systemParts.push('- Error: { "ok": false, "error": { "code": "ERROR_CODE", "message": "..." } }');
      systemParts.push('- Include "confidence" (0-1) and "rationale" in data');
    }
    if (module.output?.require_behavior_equivalence) {
      systemParts.push('- Include "behavior_equivalence" (boolean) in data');
    }
  } else {
    systemParts.push('', 'OUTPUT FORMAT:');
    systemParts.push('- Respond with ONLY valid JSON');
    systemParts.push('- Include "confidence" (0-1) and "rationale" fields');
    if (module.output?.require_behavior_equivalence) {
      systemParts.push('- Include "behavior_equivalence" (boolean) field');
    }
  }

  const messages: Message[] = [
    { role: 'system', content: systemParts.join('\n') },
    { role: 'user', content: prompt },
  ];

  // Invoke provider
  const result = await provider.invoke({
    messages,
    jsonSchema: module.outputSchema,
    temperature: 0.3,
  });

  if (verbose) {
    console.error('--- Response ---');
    console.error(result.content);
    console.error('--- End Response ---');
  }

  // Parse response
  let parsed: unknown;
  try {
    const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : result.content;
    parsed = JSON.parse(jsonStr.trim());
  } catch {
    throw new Error(`Failed to parse JSON response: ${result.content.substring(0, 500)}`);
  }

  // Handle envelope format
  if (shouldUseEnvelope && isEnvelopeResponse(parsed)) {
    let response = parseEnvelopeResponse(parsed, result.content);
    
    // Upgrade to v2.2 if needed
    if (shouldUseV22 && response.ok && !('meta' in response && response.meta)) {
      const upgraded = wrapV21ToV22(parsed as EnvelopeResponse<unknown>, riskRule);
      response = {
        ok: true,
        meta: upgraded.meta as EnvelopeMeta,
        data: (upgraded as { data?: ModuleResultData }).data,
        raw: result.content
      } as ModuleResultV22;
    }
    
    // Apply repair pass if enabled and response needs it
    if (enableRepair && response.ok && shouldUseV22) {
      const repaired = repairEnvelope(
        response as unknown as Record<string, unknown>,
        riskRule
      );
      response = {
        ok: true,
        meta: repaired.meta as EnvelopeMeta,
        data: (repaired as { data?: ModuleResultData }).data,
        raw: result.content
      } as ModuleResultV22;
    }
    
    return response;
  }

  // Handle legacy format (non-envelope)
  const legacyResult = parseLegacyResponse(parsed, result.content);
  
  // Upgrade to v2.2 if requested
  if (shouldUseV22 && legacyResult.ok) {
    const data = (legacyResult.data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      meta: {
        confidence: (data.confidence as number) ?? 0.5,
        risk: aggregateRisk(data, riskRule),
        explain: ((data.rationale as string) ?? '').slice(0, 280) || 'No explanation provided'
      },
      data: legacyResult.data,
      raw: result.content
    } as ModuleResultV22;
  }
  
  return legacyResult;
}

/**
 * Check if response is in envelope format
 */
function isEnvelopeResponse(obj: unknown): obj is EnvelopeResponse {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return typeof o.ok === 'boolean';
}

/**
 * Parse envelope format response (supports both v2.1 and v2.2)
 */
function parseEnvelopeResponse(response: EnvelopeResponse<unknown>, raw: string): ModuleResult {
  // Check if v2.2 format (has meta)
  if (isV22Envelope(response)) {
    if (response.ok) {
      return {
        ok: true,
        meta: response.meta,
        data: response.data as ModuleResultData,
        raw,
      } as ModuleResultV22;
    } else {
      return {
        ok: false,
        meta: response.meta,
        error: response.error,
        partial_data: response.partial_data,
        raw,
      } as ModuleResultV22;
    }
  }
  
  // v2.1 format
  if (response.ok) {
    const data = (response.data ?? {}) as ModuleResultData & { confidence?: number };
    return {
      ok: true,
      data: {
        ...data,
        confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
        rationale: typeof data.rationale === 'string' ? data.rationale : '',
        behavior_equivalence: data.behavior_equivalence,
      },
      raw,
    } as ModuleResultV21;
  } else {
    return {
      ok: false,
      error: response.error,
      partial_data: response.partial_data,
      raw,
    } as ModuleResultV21;
  }
}

/**
 * Parse legacy (non-envelope) format response
 */
function parseLegacyResponse(output: unknown, raw: string): ModuleResult {
  const outputObj = output as Record<string, unknown>;
  const confidence = typeof outputObj.confidence === 'number' ? outputObj.confidence : 0.5;
  const rationale = typeof outputObj.rationale === 'string' ? outputObj.rationale : '';
  const behaviorEquivalence = typeof outputObj.behavior_equivalence === 'boolean' 
    ? outputObj.behavior_equivalence 
    : undefined;

  // Check if this is an error response (has error.code)
  if (outputObj.error && typeof outputObj.error === 'object') {
    const errorObj = outputObj.error as Record<string, unknown>;
    if (typeof errorObj.code === 'string') {
      return {
        ok: false,
        error: {
          code: errorObj.code,
          message: typeof errorObj.message === 'string' ? errorObj.message : 'Unknown error',
        },
        raw,
      };
    }
  }

  // Return as v2.1 format (data includes confidence)
  return {
    ok: true,
    data: {
      ...outputObj,
      confidence,
      rationale,
      behavior_equivalence: behaviorEquivalence,
    },
    raw,
  } as ModuleResultV21;
}

/**
 * Build prompt with clean variable substitution
 */
function buildPrompt(module: CognitiveModule, input: ModuleInput): string {
  let prompt = module.prompt;

  // v2 style: substitute ${variable} placeholders
  for (const [key, value] of Object.entries(input)) {
    const strValue = typeof value === 'string' ? value : JSON.stringify(value);
    prompt = prompt.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), strValue);
  }

  // v1 compatibility: substitute $ARGUMENTS
  const argsValue = input.code || input.query || '';
  prompt = prompt.replace(/\$ARGUMENTS/g, argsValue);

  // Substitute $N placeholders (v1 compatibility)
  if (typeof argsValue === 'string') {
    const argsList = argsValue.split(/\s+/);
    argsList.forEach((arg, i) => {
      prompt = prompt.replace(new RegExp(`\\$${i}\\b`, 'g'), arg);
    });
  }

  // Append input summary if not already in prompt
  if (!prompt.includes(argsValue) && argsValue) {
    prompt += '\n\n## Input\n\n';
    if (input.code) {
      prompt += '```\n' + input.code + '\n```\n';
    }
    if (input.query) {
      prompt += input.query + '\n';
    }
    if (input.language) {
      prompt += `\nLanguage: ${input.language}\n`;
    }
  }

  return prompt;
}

/**
 * Heuristic to detect if input looks like code
 */
function looksLikeCode(str: string): boolean {
  const codeIndicators = [
    /^(def|function|class|const|let|var|import|export|public|private)\s/,
    /[{};()]/,
    /=>/,
    /\.(py|js|ts|go|rs|java|cpp|c|rb)$/,
  ];
  return codeIndicators.some(re => re.test(str));
}

// =============================================================================
// v2.5 Streaming Support
// =============================================================================

export interface StreamRunOptions extends RunOptions {
  /** Callback for each chunk */
  onChunk?: (chunk: StreamingChunk) => void;
  
  /** Callback for progress updates */
  onProgress?: (percent: number, message?: string) => void;
  
  /** Heartbeat interval in milliseconds (default: 15000) */
  heartbeatInterval?: number;
  
  /** Maximum stream duration in milliseconds (default: 300000) */
  maxDuration?: number;
}

/**
 * Create a new streaming session
 */
function createStreamingSession(moduleName: string): StreamingSession {
  return {
    session_id: `sess_${randomUUID().slice(0, 12)}`,
    module_name: moduleName,
    started_at: Date.now(),
    chunks_sent: 0,
    accumulated_data: {},
    accumulated_text: {}
  };
}

/**
 * Create meta chunk (initial streaming response)
 */
function createMetaChunk(session: StreamingSession, meta: Partial<EnvelopeMeta>): MetaChunk {
  return {
    ok: true,
    streaming: true,
    session_id: session.session_id,
    meta
  };
}

/**
 * Create delta chunk (incremental content)
 * Note: Delta chunks don't include session_id per v2.5 spec
 */
function createDeltaChunk(
  session: StreamingSession,
  field: string,
  delta: string
): DeltaChunk {
  session.chunks_sent++;
  return {
    chunk: {
      seq: session.chunks_sent,
      type: 'delta',
      field,
      delta
    }
  };
}

/**
 * Create progress chunk
 * Note: Progress chunks don't include session_id per v2.5 spec
 */
function createProgressChunk(
  _session: StreamingSession,
  percent: number,
  stage?: string,
  message?: string
): ProgressChunk {
  return {
    progress: {
      percent,
      stage,
      message
    }
  };
}

/**
 * Create final chunk (completion signal)
 * Note: Final chunks don't include session_id per v2.5 spec
 */
function createFinalChunk(
  _session: StreamingSession,
  meta: EnvelopeMeta,
  data: ModuleResultData,
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number }
): FinalChunk {
  return {
    final: true,
    meta,
    data,
    usage
  };
}

/**
 * Create error chunk
 */
function createErrorChunk(
  session: StreamingSession,
  code: string,
  message: string,
  recoverable: boolean = false,
  partialData?: unknown
): ErrorChunk {
  return {
    ok: false,
    streaming: true,
    session_id: session.session_id,
    error: {
      code,
      message,
      recoverable
    },
    partial_data: partialData
  };
}

/**
 * Run module with streaming response
 * 
 * @param module - The cognitive module to execute
 * @param provider - The LLM provider
 * @param options - Run options including streaming callbacks
 * @yields Streaming chunks
 */
export async function* runModuleStream(
  module: CognitiveModule,
  provider: Provider,
  options: StreamRunOptions = {}
): AsyncGenerator<StreamingChunk, ModuleResult | undefined, unknown> {
  const { 
    onChunk, 
    onProgress,
    heartbeatInterval = 15000,
    maxDuration = 300000,
    ...runOptions 
  } = options;
  
  // Create streaming session
  const session = createStreamingSession(module.name);
  const startTime = Date.now();
  
  // Check if module supports streaming
  if (!moduleSupportsStreaming(module)) {
    // Fallback to sync execution
    const result = await runModule(module, provider, runOptions);
    
    // Emit as single final chunk
    if (result.ok && 'meta' in result) {
      const finalChunk = createFinalChunk(
        session,
        result.meta,
        result.data as ModuleResultData
      );
      yield finalChunk;
      onChunk?.(finalChunk);
      return result;
    }
    
    return result;
  }
  
  // Check if provider supports streaming
  if (!isProviderV25(provider) || !provider.supportsStreaming?.()) {
    // Fallback to sync with warning
    console.warn('[cognitive] Provider does not support streaming, falling back to sync');
    const result = await runModule(module, provider, runOptions);
    
    if (result.ok && 'meta' in result) {
      const finalChunk = createFinalChunk(
        session,
        result.meta,
        result.data as ModuleResultData
      );
      yield finalChunk;
      onChunk?.(finalChunk);
    }
    
    return result;
  }
  
  // Emit initial meta chunk
  const metaChunk = createMetaChunk(session, {
    confidence: undefined,
    risk: 'low',
    explain: 'Processing...'
  });
  yield metaChunk;
  onChunk?.(metaChunk);
  
  // Build prompt and messages (same as sync)
  const { input, args, verbose = false, useEnvelope, useV22 } = runOptions;
  const shouldUseEnvelope = useEnvelope ?? (module.output?.envelope === true || module.format === 'v2');
  const isV22Module = module.tier !== undefined || module.formatVersion === 'v2.2';
  const shouldUseV22 = useV22 ?? (isV22Module || module.compat?.runtime_auto_wrap === true);
  const riskRule: RiskRule = module.metaConfig?.risk_rule ?? 'max_changes_risk';
  
  const inputData: ModuleInput = input || {};
  if (args && !inputData.code && !inputData.query) {
    if (looksLikeCode(args)) {
      inputData.code = args;
    } else {
      inputData.query = args;
    }
  }
  
  // Extract media from input
  const mediaInputs = extractMediaInputs(inputData);
  
  // Build prompt with media placeholders
  const prompt = buildPromptWithMedia(module, inputData, mediaInputs);
  
  // Build system message
  const systemParts = buildSystemMessage(module, shouldUseEnvelope, shouldUseV22);
  
  const messages: Message[] = [
    { role: 'system', content: systemParts.join('\n') },
    { role: 'user', content: prompt },
  ];
  
  try {
    // Start streaming invocation
    const streamResult = await provider.invokeStream!({
      messages,
      jsonSchema: module.outputSchema,
      temperature: 0.3,
      stream: true,
      images: mediaInputs.images,
      audio: mediaInputs.audio,
      video: mediaInputs.video
    });
    
    let accumulatedContent = '';
    let lastProgressTime = Date.now();
    
    // Process stream
    for await (const chunk of streamResult.stream) {
      // Check timeout
      if (Date.now() - startTime > maxDuration) {
        const errorChunk = createErrorChunk(
          session,
          ErrorCodesV25.STREAM_TIMEOUT,
          `Stream exceeded max duration of ${maxDuration}ms`,
          false,
          { partial_content: accumulatedContent }
        );
        yield errorChunk;
        onChunk?.(errorChunk);
        return undefined;
      }
      
      // Accumulate content
      accumulatedContent += chunk;
      
      // Emit delta chunk
      const deltaChunk = createDeltaChunk(session, 'data.rationale', chunk);
      yield deltaChunk;
      onChunk?.(deltaChunk);
      
      // Emit progress periodically
      const now = Date.now();
      if (now - lastProgressTime > 1000) {
        const elapsed = now - startTime;
        const estimatedPercent = Math.min(90, Math.floor(elapsed / maxDuration * 100));
        const progressChunk = createProgressChunk(
          session,
          estimatedPercent,
          'generating',
          'Generating response...'
        );
        yield progressChunk;
        onProgress?.(estimatedPercent, 'Generating response...');
        lastProgressTime = now;
      }
    }
    
    // Parse accumulated response
    let parsed: unknown;
    try {
      const jsonMatch = accumulatedContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : accumulatedContent;
      parsed = JSON.parse(jsonStr.trim());
    } catch {
      // Try to extract partial JSON
      const errorChunk = createErrorChunk(
        session,
        'E3001',
        `Failed to parse JSON response`,
        false,
        { raw: accumulatedContent }
      );
      yield errorChunk;
      onChunk?.(errorChunk);
      return undefined;
    }
    
    // Process parsed response
    let result: ModuleResult;
    if (shouldUseEnvelope && typeof parsed === 'object' && parsed !== null && 'ok' in parsed) {
      const response = parseEnvelopeResponseLocal(parsed as EnvelopeResponse<unknown>, accumulatedContent);
      
      if (shouldUseV22 && response.ok && !('meta' in response && response.meta)) {
        const upgraded = wrapV21ToV22Local(parsed as EnvelopeResponse<unknown>, riskRule);
        result = {
          ok: true,
          meta: upgraded.meta as EnvelopeMeta,
          data: (upgraded as { data?: ModuleResultData }).data,
          raw: accumulatedContent
        } as ModuleResultV22;
      } else {
        result = response;
      }
    } else {
      result = parseLegacyResponseLocal(parsed, accumulatedContent);
      
      if (shouldUseV22 && result.ok) {
        const data = (result.data ?? {}) as Record<string, unknown>;
        result = {
          ok: true,
          meta: {
            confidence: (data.confidence as number) ?? 0.5,
            risk: aggregateRisk(data, riskRule),
            explain: ((data.rationale as string) ?? '').slice(0, 280) || 'No explanation provided'
          },
          data: result.data,
          raw: accumulatedContent
        } as ModuleResultV22;
      }
    }
    
    // Emit final chunk
    if (result.ok && 'meta' in result) {
      const finalChunk = createFinalChunk(
        session,
        result.meta,
        result.data as ModuleResultData,
        streamResult.usage ? {
          input_tokens: streamResult.usage.promptTokens,
          output_tokens: streamResult.usage.completionTokens,
          total_tokens: streamResult.usage.totalTokens
        } : undefined
      );
      yield finalChunk;
      onChunk?.(finalChunk);
      onProgress?.(100, 'Complete');
    }
    
    return result;
    
  } catch (error) {
    const errorChunk = createErrorChunk(
      session,
      ErrorCodesV25.STREAM_INTERRUPTED,
      error instanceof Error ? error.message : 'Stream interrupted',
      true
    );
    yield errorChunk;
    onChunk?.(errorChunk);
    return undefined;
  }
}

// Local versions of helper functions to avoid circular issues
function parseEnvelopeResponseLocal(response: EnvelopeResponse<unknown>, raw: string): ModuleResult {
  if (isV22Envelope(response)) {
    if (response.ok) {
      return {
        ok: true,
        meta: response.meta,
        data: response.data as ModuleResultData,
        raw,
      } as ModuleResultV22;
    } else {
      return {
        ok: false,
        meta: response.meta,
        error: response.error,
        partial_data: response.partial_data,
        raw,
      } as ModuleResultV22;
    }
  }
  
  if (response.ok) {
    const data = (response.data ?? {}) as ModuleResultData & { confidence?: number };
    return {
      ok: true,
      data: {
        ...data,
        confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
        rationale: typeof data.rationale === 'string' ? data.rationale : '',
        behavior_equivalence: data.behavior_equivalence,
      },
      raw,
    } as ModuleResultV21;
  } else {
    return {
      ok: false,
      error: response.error,
      partial_data: response.partial_data,
      raw,
    } as ModuleResultV21;
  }
}

function wrapV21ToV22Local(
  response: EnvelopeResponse<unknown>,
  riskRule: RiskRule = 'max_changes_risk'
): EnvelopeResponseV22<unknown> {
  if (isV22Envelope(response)) {
    return response;
  }
  
  if (response.ok) {
    const data = (response.data ?? {}) as Record<string, unknown>;
    const confidence = (data.confidence as number) ?? 0.5;
    const rationale = (data.rationale as string) ?? '';
    
    return {
      ok: true,
      meta: {
        confidence,
        risk: aggregateRisk(data, riskRule),
        explain: rationale.slice(0, 280) || 'No explanation provided'
      },
      data: data as ModuleResultData
    };
  } else {
    const errorMsg = response.error?.message ?? 'Unknown error';
    return {
      ok: false,
      meta: {
        confidence: 0,
        risk: 'high',
        explain: errorMsg.slice(0, 280)
      },
      error: response.error ?? { code: 'UNKNOWN', message: errorMsg },
      partial_data: response.partial_data
    };
  }
}

function parseLegacyResponseLocal(output: unknown, raw: string): ModuleResult {
  const outputObj = output as Record<string, unknown>;
  const confidence = typeof outputObj.confidence === 'number' ? outputObj.confidence : 0.5;
  const rationale = typeof outputObj.rationale === 'string' ? outputObj.rationale : '';
  const behaviorEquivalence = typeof outputObj.behavior_equivalence === 'boolean' 
    ? outputObj.behavior_equivalence 
    : undefined;

  if (outputObj.error && typeof outputObj.error === 'object') {
    const errorObj = outputObj.error as Record<string, unknown>;
    if (typeof errorObj.code === 'string') {
      return {
        ok: false,
        error: {
          code: errorObj.code,
          message: typeof errorObj.message === 'string' ? errorObj.message : 'Unknown error',
        },
        raw,
      };
    }
  }

  return {
    ok: true,
    data: {
      ...outputObj,
      confidence,
      rationale,
      behavior_equivalence: behaviorEquivalence,
    },
    raw,
  } as ModuleResultV21;
}

// =============================================================================
// v2.5 Multimodal Support
// =============================================================================

interface ExtractedMedia {
  images: MediaInput[];
  audio: MediaInput[];
  video: MediaInput[];
}

/**
 * Extract media inputs from module input data
 */
function extractMediaInputs(input: ModuleInput): ExtractedMedia {
  const images: MediaInput[] = [];
  const audio: MediaInput[] = [];
  const video: MediaInput[] = [];
  
  // Check for images array
  if (Array.isArray(input.images)) {
    for (const img of input.images) {
      if (isValidMediaInput(img)) {
        images.push(img);
      }
    }
  }
  
  // Check for audio array
  if (Array.isArray(input.audio)) {
    for (const aud of input.audio) {
      if (isValidMediaInput(aud)) {
        audio.push(aud);
      }
    }
  }
  
  // Check for video array
  if (Array.isArray(input.video)) {
    for (const vid of input.video) {
      if (isValidMediaInput(vid)) {
        video.push(vid);
      }
    }
  }
  
  return { images, audio, video };
}

/**
 * Validate media input structure
 */
function isValidMediaInput(input: unknown): input is MediaInput {
  if (typeof input !== 'object' || input === null) return false;
  const obj = input as Record<string, unknown>;
  
  if (obj.type === 'url' && typeof obj.url === 'string') return true;
  if (obj.type === 'base64' && typeof obj.data === 'string' && typeof obj.media_type === 'string') return true;
  if (obj.type === 'file' && typeof obj.path === 'string') return true;
  
  return false;
}

/**
 * Build prompt with media placeholders
 */
function buildPromptWithMedia(
  module: CognitiveModule,
  input: ModuleInput,
  media: ExtractedMedia
): string {
  let prompt = buildPrompt(module, input);
  
  // Replace $MEDIA_INPUTS placeholder
  if (prompt.includes('$MEDIA_INPUTS')) {
    const mediaSummary = buildMediaSummary(media);
    prompt = prompt.replace(/\$MEDIA_INPUTS/g, mediaSummary);
  }
  
  return prompt;
}

/**
 * Build summary of media inputs for prompt
 */
function buildMediaSummary(media: ExtractedMedia): string {
  const parts: string[] = [];
  
  if (media.images.length > 0) {
    parts.push(`[${media.images.length} image(s) attached]`);
  }
  if (media.audio.length > 0) {
    parts.push(`[${media.audio.length} audio file(s) attached]`);
  }
  if (media.video.length > 0) {
    parts.push(`[${media.video.length} video file(s) attached]`);
  }
  
  return parts.length > 0 ? parts.join('\n') : '[No media attached]';
}

/**
 * Build system message for module execution
 */
function buildSystemMessage(
  module: CognitiveModule,
  shouldUseEnvelope: boolean,
  shouldUseV22: boolean
): string[] {
  const systemParts: string[] = [
    `You are executing the "${module.name}" Cognitive Module.`,
    '',
    `RESPONSIBILITY: ${module.responsibility}`,
  ];

  if (module.excludes.length > 0) {
    systemParts.push('', 'YOU MUST NOT:');
    module.excludes.forEach(e => systemParts.push(`- ${e}`));
  }

  if (module.constraints) {
    systemParts.push('', 'CONSTRAINTS:');
    if (module.constraints.no_network) systemParts.push('- No network access');
    if (module.constraints.no_side_effects) systemParts.push('- No side effects');
    if (module.constraints.no_file_write) systemParts.push('- No file writes');
    if (module.constraints.no_inventing_data) systemParts.push('- Do not invent data');
  }

  if (module.output?.require_behavior_equivalence) {
    systemParts.push('', 'BEHAVIOR EQUIVALENCE:');
    systemParts.push('- You MUST set behavior_equivalence=true ONLY if the output is functionally identical');
    systemParts.push('- If unsure, set behavior_equivalence=false and explain in rationale');
    
    const maxConfidence = module.constraints?.behavior_equivalence_false_max_confidence ?? 0.7;
    systemParts.push(`- If behavior_equivalence=false, confidence MUST be <= ${maxConfidence}`);
  }

  // Add multimodal instructions if module supports it
  if (isModuleV25(module) && moduleSupportsMultimodal(module)) {
    const inputModalities = getModuleInputModalities(module);
    systemParts.push('', 'MULTIMODAL INPUT:');
    systemParts.push(`- This module accepts: ${inputModalities.join(', ')}`);
    systemParts.push('- Analyze any attached media carefully');
    systemParts.push('- Reference specific elements from the media in your analysis');
  }

  // Add envelope format instructions
  if (shouldUseEnvelope) {
    if (shouldUseV22) {
      systemParts.push('', 'RESPONSE FORMAT (Envelope v2.2):');
      systemParts.push('- Wrap your response in the v2.2 envelope format with separate meta and data');
      systemParts.push('- Success: { "ok": true, "meta": { "confidence": 0.9, "risk": "low", "explain": "short summary" }, "data": { ...payload... } }');
      systemParts.push('- Error: { "ok": false, "meta": { "confidence": 0.0, "risk": "high", "explain": "error summary" }, "error": { "code": "ERROR_CODE", "message": "..." } }');
      systemParts.push('- meta.explain must be ≤280 characters. data.rationale can be longer for detailed reasoning.');
      systemParts.push('- meta.risk must be one of: "none", "low", "medium", "high"');
    } else {
      systemParts.push('', 'RESPONSE FORMAT (Envelope):');
      systemParts.push('- Wrap your response in the envelope format');
      systemParts.push('- Success: { "ok": true, "data": { ...your output... } }');
      systemParts.push('- Error: { "ok": false, "error": { "code": "ERROR_CODE", "message": "..." } }');
      systemParts.push('- Include "confidence" (0-1) and "rationale" in data');
    }
    if (module.output?.require_behavior_equivalence) {
      systemParts.push('- Include "behavior_equivalence" (boolean) in data');
    }
  } else {
    systemParts.push('', 'OUTPUT FORMAT:');
    systemParts.push('- Respond with ONLY valid JSON');
    systemParts.push('- Include "confidence" (0-1) and "rationale" fields');
    if (module.output?.require_behavior_equivalence) {
      systemParts.push('- Include "behavior_equivalence" (boolean) field');
    }
  }

  return systemParts;
}

/**
 * Load media file as base64
 */
export async function loadMediaAsBase64(path: string): Promise<{ data: string; media_type: string } | null> {
  try {
    if (!existsSync(path)) {
      return null;
    }
    
    const buffer = await readFile(path);
    const data = buffer.toString('base64');
    const media_type = getMediaTypeFromExtension(extname(path));
    
    return { data, media_type };
  } catch {
    return null;
  }
}

/**
 * Get MIME type from file extension
 */
function getMediaTypeFromExtension(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.webm': 'audio/webm',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.pdf': 'application/pdf'
  };
  
  return mimeTypes[ext.toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Validate media input against module constraints
 */
export function validateMediaInput(
  media: MediaInput,
  module: CognitiveModule,
  maxSizeMb: number = 20
): { valid: boolean; error?: string; code?: string } {
  // Check if module supports multimodal
  if (!moduleSupportsMultimodal(module)) {
    return {
      valid: false,
      error: 'Module does not support multimodal input',
      code: ErrorCodesV25.MULTIMODAL_NOT_SUPPORTED
    };
  }
  
  // Validate media type
  if (media.type === 'base64') {
    const mediaType = (media as { media_type: string }).media_type;
    if (!isValidMediaType(mediaType)) {
      return {
        valid: false,
        error: `Unsupported media type: ${mediaType}`,
        code: ErrorCodesV25.UNSUPPORTED_MEDIA_TYPE
      };
    }
  }
  
  // Size validation would require fetching/checking actual data
  // This is a placeholder for the check
  
  return { valid: true };
}

/**
 * Check if media type is supported
 */
function isValidMediaType(mediaType: string): boolean {
  const supported = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf'
  ];
  
  return supported.includes(mediaType);
}

/**
 * Get runtime capabilities
 */
export function getRuntimeCapabilities(): RuntimeCapabilities {
  return { ...DEFAULT_RUNTIME_CAPABILITIES };
}

/**
 * Check if runtime supports a specific modality
 */
export function runtimeSupportsModality(
  modality: ModalityType,
  direction: 'input' | 'output' = 'input'
): boolean {
  const caps = getRuntimeCapabilities();
  return caps.multimodal[direction].includes(modality);
}
