/**
 * Module Runner - Execute Cognitive Modules
 * v2.1: Envelope format support, clean input mapping
 */

import type { 
  Provider, 
  CognitiveModule, 
  ModuleResult, 
  ModuleResultV21,
  Message, 
  ModuleInput,
  EnvelopeResponse,
  ModuleResultData
} from '../types.js';

export interface RunOptions {
  // Clean input (v2 style)
  input?: ModuleInput;
  
  // Legacy CLI args (v1 compatibility) - mapped to input.code or input.query
  args?: string;
  
  // Runtime options
  verbose?: boolean;
  
  // Force envelope format (default: auto-detect from module.output.envelope)
  useEnvelope?: boolean;
}

export async function runModule(
  module: CognitiveModule,
  provider: Provider,
  options: RunOptions = {}
): Promise<ModuleResult> {
  const { args, input, verbose = false, useEnvelope } = options;

  // Determine if we should use envelope format
  const shouldUseEnvelope = useEnvelope ?? (module.output?.envelope === true || module.format === 'v2');

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
    systemParts.push('', 'RESPONSE FORMAT (Envelope):');
    systemParts.push('- Wrap your response in the envelope format');
    systemParts.push('- Success: { "ok": true, "data": { ...your output... } }');
    systemParts.push('- Error: { "ok": false, "error": { "code": "ERROR_CODE", "message": "..." } }');
    systemParts.push('- Include "confidence" (0-1) and "rationale" in data');
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
    return parseEnvelopeResponse(parsed, result.content);
  }

  // Handle legacy format (non-envelope)
  return parseLegacyResponse(parsed, result.content);
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
 * Parse envelope format response
 */
function parseEnvelopeResponse(response: EnvelopeResponse, raw: string): ModuleResult {
  if (response.ok) {
    const data = response.data as ModuleResultData;
    return {
      ok: true,
      data: {
        ...data,
        confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
        rationale: typeof data.rationale === 'string' ? data.rationale : '',
        behavior_equivalence: data.behavior_equivalence,
      },
      raw,
    };
  } else {
    return {
      ok: false,
      error: response.error,
      partial_data: response.partial_data,
      raw,
    };
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
