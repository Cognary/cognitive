/**
 * Module Runner - Execute Cognitive Modules
 * v2.2: Envelope format with meta/data separation, risk_rule, repair pass
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
  RiskRule
} from '../types.js';
import { aggregateRisk, isV22Envelope } from '../types.js';

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
