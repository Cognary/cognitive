#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageDir = path.resolve(__dirname, '..', '..');
const repoDir = path.resolve(packageDir, '..', '..');
const distProvidersPath = path.join(packageDir, 'dist', 'providers', 'index.js');
const binPath = path.join(packageDir, 'bin.js');
const rawInvokeWorkerPath = path.join(__dirname, 'invoke-raw.mjs');

const DEFAULT_SUITE = path.join(__dirname, 'suite.example.json');
const DEFAULT_JSON_OUT = path.join(__dirname, 'results', 'latest.json');
const DEFAULT_MD_OUT = path.join(__dirname, 'results', 'latest.md');
const DEFAULT_MODES = ['raw-text', 'raw-schema', 'cognitive-core', 'cognitive-standard'];
const META_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['confidence', 'risk', 'explain'],
  properties: {
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    risk: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
    explain: { type: 'string', maxLength: 280 }
  }
};
const ERROR_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['code', 'message'],
  properties: {
    code: { type: 'string' },
    message: { type: 'string' },
    recoverable: { type: 'boolean' }
  }
};

function parseArgs(argv) {
  const out = {
    suite: DEFAULT_SUITE,
    runs: 3,
    modes: [...DEFAULT_MODES],
    out: DEFAULT_JSON_OUT,
    markdownOut: DEFAULT_MD_OUT,
    timeoutMs: 90000,
    provider: undefined,
    model: undefined,
    caseIds: [],
    plan: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--suite':
        out.suite = argv[++i];
        break;
      case '--provider':
        out.provider = argv[++i];
        break;
      case '--model':
        out.model = argv[++i];
        break;
      case '--runs':
        out.runs = Number(argv[++i]);
        break;
      case '--modes':
        out.modes = argv[++i].split(',').map((v) => v.trim()).filter(Boolean);
        break;
      case '--out':
        out.out = argv[++i];
        break;
      case '--markdown-out':
        out.markdownOut = argv[++i];
        break;
      case '--timeout-ms':
        out.timeoutMs = Number(argv[++i]);
        break;
      case '--case':
        out.caseIds.push(argv[++i]);
        break;
      case '--plan':
        out.plan = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(out.runs) || out.runs <= 0) {
    throw new Error(`--runs must be a positive integer; got ${out.runs}`);
  }
  if (!Number.isFinite(out.timeoutMs) || out.timeoutMs <= 0) {
    throw new Error(`--timeout-ms must be a positive number; got ${out.timeoutMs}`);
  }

  const invalidMode = out.modes.find((mode) => !DEFAULT_MODES.includes(mode));
  if (invalidMode) {
    throw new Error(`Unsupported mode: ${invalidMode}. Valid modes: ${DEFAULT_MODES.join(', ')}`);
  }

  return out;
}

function printHelp() {
  console.log(`Usage: node benchmarks/cognitive-vs-raw/run.mjs [options]

Options:
  --suite <file>         Suite JSON file (default: ${DEFAULT_SUITE})
  --provider <name>      Provider name (openai, anthropic, gemini, minimax, deepseek, qwen)
  --model <id>           Optional explicit model id
  --runs <n>             Repetitions per case/mode (default: 3)
  --modes <csv>          Modes to run (default: ${DEFAULT_MODES.join(',')})
  --case <id>            Restrict to a case id (repeatable)
  --out <file>           JSON report output path
  --markdown-out <file>  Markdown summary output path
  --timeout-ms <n>       Per-attempt timeout in milliseconds (default: 90000)
  --plan                 Print the resolved plan without invoking any provider
  --help                 Show this message
`);
}

function renderTemplate(template, input) {
  let output = template;
  for (const [key, value] of Object.entries(input)) {
    const rendered = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    output = output.replaceAll(`{{${key}}}`, rendered);
    output = output.replaceAll(`\${${key}}`, rendered);
  }
  return output;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function inferSchema(value) {
  if (Array.isArray(value)) {
    const item = value.length > 0 ? inferSchema(value[0]) : { type: 'string' };
    return { type: 'array', items: item };
  }
  if (value === null) return { type: 'null' };
  switch (typeof value) {
    case 'string':
      return { type: 'string' };
    case 'number':
      return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' };
    case 'boolean':
      return { type: 'boolean' };
    case 'object':
      return {
        type: 'object',
        additionalProperties: true,
        properties: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, inferSchema(v)])),
      };
    default:
      return { type: 'string' };
  }
}

function buildInputSchema(input) {
  return {
    type: 'object',
    additionalProperties: true,
    properties: Object.fromEntries(Object.entries(input).map(([key, value]) => [key, inferSchema(value)])),
  };
}

function buildCognitiveDataSchema(targetSchema) {
  if (!targetSchema || typeof targetSchema !== 'object' || targetSchema.type !== 'object') {
    return targetSchema;
  }

  const properties = {
    ...(targetSchema.properties ?? {}),
    rationale: { type: 'string' },
  };
  const required = Array.from(new Set([...(targetSchema.required ?? []), 'rationale']));

  return {
    ...targetSchema,
    properties,
    required,
  };
}

function collectRequiredPaths(schema, prefix = '') {
  if (!schema || typeof schema !== 'object') return [];
  if (schema.type !== 'object' || !schema.properties) return [];

  const required = Array.isArray(schema.required) ? schema.required : [];
  const paths = [];

  for (const key of required) {
    const child = schema.properties[key];
    const fullPath = prefix ? `${prefix}.${key}` : key;
    paths.push(fullPath);
    if (child?.type === 'object') {
      paths.push(...collectRequiredPaths(child, fullPath));
    }
  }

  return paths;
}

function getAtPath(value, targetPath) {
  if (!targetPath) return value;
  const parts = targetPath.split('.');
  let current = value;
  for (const part of parts) {
    if (current == null) return undefined;
    if (Array.isArray(current) && /^\d+$/.test(part)) {
      current = current[Number(part)];
      continue;
    }
    current = current[part];
  }
  return current;
}

function evaluateSemanticChecks(normalized, checks = []) {
  if (!checks.length) return null;
  const failures = [];

  for (const check of checks) {
    const actual = getAtPath(normalized, check.path);
    switch (check.type) {
      case 'equals':
        if (actual !== check.value) failures.push({ check, actual });
        break;
      case 'includes':
        if (typeof actual !== 'string' || !actual.toLowerCase().includes(String(check.value).toLowerCase())) {
          failures.push({ check, actual });
        }
        break;
      case 'includes_any':
        if (
          typeof actual !== 'string' ||
          !Array.isArray(check.value) ||
          !check.value.some((candidate) => actual.toLowerCase().includes(String(candidate).toLowerCase()))
        ) {
          failures.push({ check, actual });
        }
        break;
      case 'one_of':
        if (!Array.isArray(check.value) || !check.value.includes(actual)) {
          failures.push({ check, actual });
        }
        break;
      case 'min_items':
        if (!Array.isArray(actual) || actual.length < Number(check.value)) {
          failures.push({ check, actual });
        }
        break;
      case 'array_object_any': {
        if (!Array.isArray(actual)) {
          failures.push({ check, actual });
          break;
        }
        const field = String(check.field || '');
        const matcher = String(check.matcher || 'equals');
        const matched = actual.some((item) => {
          if (!item || typeof item !== 'object') return false;
          const fieldValue = item[field];
          switch (matcher) {
            case 'equals':
              return fieldValue === check.value;
            case 'one_of':
              return Array.isArray(check.value) && check.value.includes(fieldValue);
            case 'includes':
              return typeof fieldValue === 'string' && fieldValue.toLowerCase().includes(String(check.value).toLowerCase());
            case 'includes_any':
              return (
                typeof fieldValue === 'string' &&
                Array.isArray(check.value) &&
                check.value.some((candidate) => fieldValue.toLowerCase().includes(String(candidate).toLowerCase()))
              );
            case 'truthy':
              return Boolean(fieldValue);
            default:
              return false;
          }
        });
        if (!matched) failures.push({ check, actual });
        break;
      }
      case 'truthy':
        if (!actual) failures.push({ check, actual });
        break;
      default:
        failures.push({ check, actual, reason: 'unknown_check_type' });
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

function extractJson(text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Empty response');

  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) {
    return JSON.parse(fence[1].trim());
  }

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1));
  }

  throw new Error('Response does not contain valid JSON');
}

function validateEnvelope(value) {
  if (!value || typeof value !== 'object') return { passed: false, reason: 'not_object' };
  if (typeof value.ok !== 'boolean') return { passed: false, reason: 'missing_ok' };
  if (typeof value.version !== 'string') return { passed: false, reason: 'missing_version' };
  if (!value.meta || typeof value.meta !== 'object') return { passed: false, reason: 'missing_meta' };
  if (typeof value.meta.confidence !== 'number') return { passed: false, reason: 'missing_meta_confidence' };
  if (typeof value.meta.risk !== 'string') return { passed: false, reason: 'missing_meta_risk' };
  if (typeof value.meta.explain !== 'string') return { passed: false, reason: 'missing_meta_explain' };
  if (value.ok === true && (!value.data || typeof value.data !== 'object')) return { passed: false, reason: 'missing_data' };
  if (value.ok === false && (!value.error || typeof value.error !== 'object')) return { passed: false, reason: 'missing_error' };
  return { passed: true };
}

function buildRawMessages(testCase) {
  const system = testCase.raw?.system || 'You are a careful engineering assistant. Return JSON only.';
  const userTemplate = testCase.raw?.userTemplate || [
    'Task:',
    testCase.taskPrompt,
    '',
    'Input:',
    '{{INPUT_JSON}}',
    '',
    'Return JSON only. Do not use markdown fences.'
  ].join('\n');

  const user = renderTemplate(userTemplate, {
    ...testCase.input,
    INPUT_JSON: JSON.stringify(testCase.input, null, 2),
  });

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

function buildModulePrompt(testCase) {
  const inputKeys = Object.keys(testCase.input);
  const inputSections = inputKeys.map((key) => `${key}:\n\${${key}}\n`).join('\n');

  return [
    'You are a Cognitive Module. Return JSON only (no markdown).',
    'Return a valid v2.2 envelope with meta + data.',
    '',
    'TASK:',
    testCase.taskPrompt,
    '',
    'INPUT (provided by runtime):',
    ...inputKeys.map((key) => `- ${key}`),
    '',
    'You MUST treat missing fields as empty.',
    '',
    'INPUT VALUES:',
    inputSections.trimEnd(),
    '',
    'Target data schema:',
    JSON.stringify(testCase.targetSchema, null, 2),
    '',
    'Output requirements:',
    '- ok: true',
    '- version: "2.2" (runtime may normalize this field)',
    '- meta.confidence: 0-1',
    "- meta.risk: one of 'none' | 'low' | 'medium' | 'high'",
    '- meta.explain: <=280 chars',
    '- data.rationale: string',
    '- data MUST satisfy the target data schema',
  ].join('\n');
}

function buildModuleYaml(testCase) {
  return [
    `name: ${testCase.id}`,
    'version: 0.1.0',
    `responsibility: ${JSON.stringify(testCase.description)}`,
    `tier: ${testCase.kind === 'structured-extraction' ? 'exploration' : 'decision'}`,
    'schema_strictness: medium',
    'excludes:',
    '  - do not make network calls',
    '  - do not write files',
    ''
  ].join('\n');
}

async function createCognitiveFixtures(testCase) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), `cognitive-bench-${testCase.id}-`));
  const singleFilePath = path.join(tempRoot, `${testCase.id}.md`);
  const moduleName = `${testCase.id}-bench-${crypto.randomBytes(4).toString('hex')}`;
  const moduleDir = path.join(repoDir, 'cognitive', 'modules', moduleName);

  const frontmatter = [
    '---',
    `name: ${testCase.id}`,
    'version: 0.1.0',
    `responsibility: ${JSON.stringify(testCase.description)}`,
    `tier: ${testCase.kind === 'structured-extraction' ? 'exploration' : 'decision'}`,
    'schema_strictness: low',
    '---',
    '',
    buildModulePrompt(testCase),
    '',
  ].join('\n');
  await fs.writeFile(singleFilePath, frontmatter, 'utf8');

  await fs.mkdir(moduleDir, { recursive: true });
  await fs.writeFile(path.join(moduleDir, 'module.yaml'), buildModuleYaml(testCase), 'utf8');
  await fs.writeFile(path.join(moduleDir, 'prompt.md'), `${buildModulePrompt(testCase)}\n`, 'utf8');
  await fs.writeFile(path.join(moduleDir, 'schema.json'), JSON.stringify({
    meta: META_SCHEMA,
    input: buildInputSchema(testCase.input),
    data: buildCognitiveDataSchema(testCase.targetSchema),
    error: ERROR_SCHEMA,
  }, null, 2) + '\n', 'utf8');

  return { tempRoot, singleFilePath, moduleDir, moduleName };
}

function normalizeTargetPayload(testCase, parsed, mode) {
  if (!parsed) return undefined;
  if (!mode.startsWith('cognitive-')) return parsed;
  if (!parsed.data || typeof parsed.data !== 'object') return undefined;

  const normalized = { ...parsed.data };
  const schemaProps = testCase.targetSchema?.properties ?? {};
  if (!Object.prototype.hasOwnProperty.call(schemaProps, 'rationale')) {
    delete normalized.rationale;
  }
  return normalized;
}

async function invokeRaw(provider, testCase, options, mode) {
  const params = {
    messages: buildRawMessages(testCase),
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  };

  if (mode === 'raw-schema') {
    params.jsonSchema = testCase.targetSchema;
    params.jsonSchemaMode = 'prompt';
  }

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), `cognitive-bench-raw-${testCase.id}-`));
  const payloadPath = path.join(tempRoot, 'payload.json');
  await fs.writeFile(payloadPath, JSON.stringify({
    provider: provider.name,
    model: options.model,
    params,
  }), 'utf8');

  try {
    const result = await spawnNodeWithTimeout(
      [rawInvokeWorkerPath, payloadPath],
      options.timeoutMs,
      tempRoot
    );
    if (result.code !== 0) {
      return {
        mode,
        ok: false,
        latencyMs: result.elapsedMs,
        error: result.stderr.trim() || result.stdout.trim() || `Raw worker exited with code ${result.code}`,
      };
    }

    const payload = JSON.parse(result.stdout);
    const parsed = extractJson(payload.result.content);
    return {
      mode,
      ok: true,
      latencyMs: result.elapsedMs,
      rawContent: payload.result.content,
      parsed,
      normalized: parsed,
      usage: payload.result.usage,
    };
  } catch (error) {
    return {
      mode,
      ok: false,
      latencyMs: options.timeoutMs,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function spawnNodeWithTimeout(args, timeoutMs, cwd = repoDir) {
  return await new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const startedAt = Date.now();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        code,
        signal,
        stdout,
        stderr,
        timedOut,
        elapsedMs: Date.now() - startedAt,
      });
    });
  });
}

async function invokeCognitive(testCase, providerName, model, mode, timeoutMs) {
  const fixtures = await createCognitiveFixtures(testCase);
  const entry = mode === 'cognitive-core' ? fixtures.singleFilePath : fixtures.moduleName;
  const profile = mode === 'cognitive-core' ? 'core' : 'standard';
  const args = [
    binPath,
    'run',
    entry,
    '--input',
    JSON.stringify(testCase.input),
    '--provider',
    providerName,
    '--profile',
    profile,
    '--pretty',
  ];
  if (model) {
    args.push('--model', model);
  }

  const startedAt = Date.now();
  try {
    const result = await spawnNodeWithTimeout(args, timeoutMs, repoDir);
    if (result.timedOut) {
      return {
        mode,
        ok: false,
        latencyMs: result.elapsedMs,
        error: `Timed out after ${result.elapsedMs}ms`,
        stderr: result.stderr.trim() || undefined,
        exitCode: result.code,
      };
    }
    const combined = `${result.stdout}`.trim();
    const parsed = extractJson(combined);
    return {
      mode,
      ok: true,
      latencyMs: result.elapsedMs || (Date.now() - startedAt),
      rawContent: combined,
      parsed,
      normalized: normalizeTargetPayload(testCase, parsed, mode),
      envelope: parsed,
      stderr: result.stderr.trim() || undefined,
      exitCode: result.code,
    };
  } catch (error) {
    return {
      mode,
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await fs.rm(fixtures.tempRoot, { recursive: true, force: true });
    await fs.rm(fixtures.moduleDir, { recursive: true, force: true });
  }
}

function summarizeAttempt(testCase, attempt, validator) {
  const summary = {
    validJson: false,
    envelopePass: null,
    targetSchemaPass: false,
    requiredFieldsComplete: false,
    semanticPass: null,
    requiredMissing: [],
    error: attempt.error,
  };

  if (!attempt.ok || attempt.parsed == null) {
    return summary;
  }

  summary.validJson = true;

  if (attempt.mode.startsWith('cognitive-')) {
    const envelopeCheck = validateEnvelope(attempt.parsed);
    summary.envelopePass = envelopeCheck.passed;
    if (!envelopeCheck.passed) {
      summary.error = envelopeCheck.reason;
    }
  }

  const normalized = attempt.normalized;
  if (normalized && validator(normalized)) {
    summary.targetSchemaPass = true;
  } else if (normalized) {
    summary.error = validator.errors?.map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ') || summary.error;
  }

  const requiredPaths = collectRequiredPaths(testCase.targetSchema);
  const missing = requiredPaths.filter((p) => {
    const value = getAtPath(normalized, p);
    return value === undefined || value === null || value === '';
  });
  summary.requiredMissing = missing;
  summary.requiredFieldsComplete = missing.length === 0;

  const semantic = evaluateSemanticChecks(normalized, testCase.semanticChecks);
  summary.semanticPass = semantic?.passed ?? null;
  if (semantic && !semantic.passed && !summary.error) {
    summary.error = semantic.failures.map((f) => `${f.check.path}:${f.check.type}`).join(', ');
  }

  return summary;
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rate(values) {
  if (!values.length) return null;
  return values.filter(Boolean).length / values.length;
}

function computeStability(results, mode) {
  const byCase = new Map();
  for (const result of results.filter((r) => r.mode === mode)) {
    if (!byCase.has(result.caseId)) byCase.set(result.caseId, []);
    byCase.get(result.caseId).push(result);
  }

  const scores = [];
  for (const attempts of byCase.values()) {
    const hashes = attempts
      .filter((a) => a.summary.validJson && a.normalized != null)
      .map((a) => sha256(stableStringify(a.normalized)));
    if (!hashes.length) continue;
    const counts = new Map();
    for (const hash of hashes) counts.set(hash, (counts.get(hash) || 0) + 1);
    const best = Math.max(...counts.values());
    scores.push(best / hashes.length);
  }

  return average(scores);
}

function flattenValuePaths(value, prefix = '', out = new Map()) {
  if (Array.isArray(value)) {
    out.set(prefix || '$', stableStringify(value));
    value.forEach((item, index) => flattenValuePaths(item, prefix ? `${prefix}.${index}` : String(index), out));
    return out;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) {
      out.set(prefix || '$', stableStringify(value));
      return out;
    }
    for (const [key, child] of entries) {
      flattenValuePaths(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }

  out.set(prefix || '$', value);
  return out;
}

function computeStabilityDiagnostics(results, mode) {
  const byCase = new Map();
  for (const result of results.filter((r) => r.mode === mode && r.summary.validJson && r.normalized != null)) {
    if (!byCase.has(result.caseId)) byCase.set(result.caseId, []);
    byCase.get(result.caseId).push(result);
  }

  const diagnostics = [];
  for (const [caseId, attempts] of byCase.entries()) {
    const hashes = attempts.map((a) => sha256(stableStringify(a.normalized)));
    const uniqueHashes = Array.from(new Set(hashes));
    if (uniqueHashes.length <= 1) continue;

    const pathValues = new Map();
    for (const attempt of attempts) {
      const flattened = flattenValuePaths(attempt.normalized);
      for (const [path, value] of flattened.entries()) {
        if (!pathValues.has(path)) pathValues.set(path, new Set());
        pathValues.get(path).add(stableStringify(value));
      }
    }

    const differingPaths = Array.from(pathValues.entries())
      .filter(([, values]) => values.size > 1)
      .map(([path, values]) => ({
        path,
        variants: Array.from(values).slice(0, 3),
      }))
      .slice(0, 8);

    diagnostics.push({
      caseId,
      variantCount: uniqueHashes.length,
      differingPaths,
    });
  }

  return diagnostics;
}

function formatPercent(value) {
  return value == null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value) {
  return value == null ? 'n/a' : `${value.toFixed(1)}`;
}

function buildMarkdownReport(report) {
  const lines = [];
  lines.push('# Cognitive vs Raw Benchmark Report');
  lines.push('');
  lines.push(`- Provider: \`${report.provider.name}\``);
  lines.push(`- Model: \`${report.provider.model}\``);
  lines.push(`- Suite: \`${report.suite.name}\``);
  lines.push(`- Runs per case: ${report.runs}`);
  lines.push(`- Generated at: ${report.generatedAt}`);
  lines.push('');
  lines.push('| Mode | valid_json_rate | target_schema_pass_rate | required_fields_complete_rate | semantic_pass_rate | manual_fix_rate | stability_rate | avg_latency_ms | avg_total_tokens |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const summary of report.modeSummaries) {
    lines.push(`| ${summary.mode} | ${formatPercent(summary.validJsonRate)} | ${formatPercent(summary.targetSchemaPassRate)} | ${formatPercent(summary.requiredFieldsCompleteRate)} | ${formatPercent(summary.semanticPassRate)} | ${formatPercent(summary.manualFixRate)} | ${formatPercent(summary.stabilityRate)} | ${formatNumber(summary.avgLatencyMs)} | ${formatNumber(summary.avgTotalTokens)} |`);
  }
  lines.push('');
  lines.push('## Case detail');
  lines.push('');
  for (const caseReport of report.caseSummaries) {
    lines.push(`### ${caseReport.id}`);
    lines.push(caseReport.description);
    lines.push('');
    for (const mode of caseReport.modes) {
      lines.push(`- ${mode.mode}: valid_json=${formatPercent(mode.validJsonRate)}, schema=${formatPercent(mode.targetSchemaPassRate)}, semantic=${formatPercent(mode.semanticPassRate)}, stability=${formatPercent(mode.stabilityRate)}`);
      if (mode.stabilityDiagnostics?.length) {
        for (const diag of mode.stabilityDiagnostics) {
          lines.push(`  - stability diff (${diag.variantCount} variants): ${diag.differingPaths.map((d) => d.path).join(', ')}`);
        }
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

function buildReport(suite, provider, options, selectedCases, attempts) {
  const modeSummaries = options.modes.map((mode) => {
    const subset = attempts.filter((attempt) => attempt.mode === mode);
    return {
      mode,
      attempts: subset.length,
      validJsonRate: rate(subset.map((attempt) => attempt.summary.validJson)),
      envelopePassRate: rate(subset.map((attempt) => attempt.summary.envelopePass).filter((value) => value != null)),
      targetSchemaPassRate: rate(subset.map((attempt) => attempt.summary.targetSchemaPass)),
      requiredFieldsCompleteRate: rate(subset.map((attempt) => attempt.summary.requiredFieldsComplete)),
      semanticPassRate: rate(subset.map((attempt) => attempt.summary.semanticPass).filter((value) => value != null)),
      manualFixRate: rate(subset.map((attempt) => !attempt.summary.targetSchemaPass)),
      stabilityRate: computeStability(attempts, mode),
      avgLatencyMs: average(subset.map((attempt) => attempt.latencyMs).filter((value) => Number.isFinite(value))),
      avgTotalTokens: average(subset.map((attempt) => attempt.usage?.totalTokens).filter((value) => Number.isFinite(value))),
    };
  });

  const caseSummaries = selectedCases.map((testCase) => ({
    id: testCase.id,
    description: testCase.description,
    modes: options.modes.map((mode) => {
      const subset = attempts.filter((attempt) => attempt.caseId === testCase.id && attempt.mode === mode);
      return {
        mode,
        validJsonRate: rate(subset.map((attempt) => attempt.summary.validJson)),
        targetSchemaPassRate: rate(subset.map((attempt) => attempt.summary.targetSchemaPass)),
        semanticPassRate: rate(subset.map((attempt) => attempt.summary.semanticPass).filter((value) => value != null)),
        stabilityRate: computeStability(subset, mode),
        stabilityDiagnostics: computeStabilityDiagnostics(subset, mode),
      };
    }),
  }));

  return {
    suite: {
      name: suite.name,
      description: suite.description,
      source: path.resolve(options.suite),
      caseCount: selectedCases.length,
    },
    provider: {
      name: provider.name,
      model: options.model || 'provider-default',
    },
    runs: options.runs,
    modes: options.modes,
    progress: {
      completed: attempts.length,
      total: selectedCases.length * options.modes.length * options.runs,
    },
    generatedAt: new Date().toISOString(),
    modeSummaries,
    caseSummaries,
    attempts: attempts.map((attempt) => ({
      caseId: attempt.caseId,
      caseKind: attempt.caseKind,
      mode: attempt.mode,
      runIndex: attempt.runIndex,
      latencyMs: attempt.latencyMs,
      usage: attempt.usage,
      summary: attempt.summary,
      outputHash: attempt.normalized != null ? sha256(stableStringify(attempt.normalized)) : null,
      rawContent: attempt.rawContent,
      stderr: attempt.stderr,
      exitCode: attempt.exitCode,
    })),
  };
}

async function writeReportFiles(report, options) {
  const jsonOut = path.resolve(options.out);
  const markdownOut = path.resolve(options.markdownOut);
  await fs.mkdir(path.dirname(jsonOut), { recursive: true });
  await fs.mkdir(path.dirname(markdownOut), { recursive: true });
  await fs.writeFile(jsonOut, JSON.stringify(report, null, 2) + '\n', 'utf8');
  await fs.writeFile(markdownOut, buildMarkdownReport(report) + '\n', 'utf8');
}

function progressPrefix(index, total) {
  return `[bench ${index}/${total}]`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  let providerModule;
  try {
    await fs.access(distProvidersPath);
    providerModule = await import(pathToFileURL(distProvidersPath).href);
  } catch {
    throw new Error(`Missing built runtime at ${distProvidersPath}. Run: npm --prefix ${packageDir} run build`);
  }

  const suite = JSON.parse(await fs.readFile(path.resolve(options.suite), 'utf8'));
  const selectedCases = options.caseIds.length
    ? suite.cases.filter((testCase) => options.caseIds.includes(testCase.id))
    : suite.cases;

  if (!selectedCases.length) {
    throw new Error('No benchmark cases selected.');
  }

  const provider = providerModule.getProvider(options.provider, options.model);
  if (!provider.isConfigured()) {
    throw new Error(`Provider ${provider.name} is not configured in this shell.`);
  }

  if (options.plan) {
    console.log(JSON.stringify({
      suite: suite.name,
      provider: provider.name,
      model: options.model || 'provider-default',
      runs: options.runs,
      modes: options.modes,
      cases: selectedCases.map((testCase) => ({ id: testCase.id, kind: testCase.kind, description: testCase.description })),
      outputs: {
        json: path.resolve(options.out),
        markdown: path.resolve(options.markdownOut),
      },
      timeoutMs: options.timeoutMs,
    }, null, 2));
    return;
  }

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const attempts = [];
  const totalAttempts = selectedCases.length * options.modes.length * options.runs;
  let sequence = 0;
  for (const testCase of selectedCases) {
    const validator = ajv.compile(testCase.targetSchema);
    for (const mode of options.modes) {
      for (let runIndex = 1; runIndex <= options.runs; runIndex++) {
        sequence += 1;
        const base = {
          caseId: testCase.id,
          caseKind: testCase.kind,
          mode,
          runIndex,
        };
        console.error(`${progressPrefix(sequence, totalAttempts)} start case=${testCase.id} mode=${mode} run=${runIndex}`);

        let attempt;
        try {
          attempt = mode.startsWith('raw-')
            ? await invokeRaw(provider, testCase, {
                temperature: suite.defaults?.temperature ?? 0.2,
                maxTokens: suite.defaults?.maxTokens ?? 1200,
                model: options.model,
                timeoutMs: options.timeoutMs,
              }, mode)
            : await invokeCognitive(testCase, provider.name, options.model, mode, options.timeoutMs);
        } catch (error) {
          attempt = {
            mode,
            ok: false,
            latencyMs: 0,
            error: error instanceof Error ? error.message : String(error),
          };
        }

        const summary = summarizeAttempt(testCase, attempt, validator);
        const fullAttempt = {
          ...base,
          ...attempt,
          summary,
        };
        attempts.push(fullAttempt);

        const report = buildReport(suite, provider, options, selectedCases, attempts);
        await writeReportFiles(report, options);
        console.error(
          `${progressPrefix(sequence, totalAttempts)} done ok=${attempt.ok ? 'true' : 'false'} ` +
            `json=${summary.validJson ? 'true' : 'false'} schema=${summary.targetSchemaPass ? 'true' : 'false'} ` +
            `semantic=${summary.semanticPass === null ? 'n/a' : summary.semanticPass ? 'true' : 'false'} ` +
            `latency_ms=${attempt.latencyMs}`
        );
      }
    }
  }

  const report = buildReport(suite, provider, options, selectedCases, attempts);
  await writeReportFiles(report, options);

  console.log(JSON.stringify({
    provider: report.provider,
    suite: report.suite,
    outputs: {
      json: path.resolve(options.out),
      markdown: path.resolve(options.markdownOut),
    },
    modeSummaries: report.modeSummaries,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
