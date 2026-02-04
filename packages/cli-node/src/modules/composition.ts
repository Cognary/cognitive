/**
 * Composition Engine - Module Composition and Orchestration
 * 
 * Implements COMPOSITION.md specification:
 * - Sequential Composition: A → B → C
 * - Parallel Composition: A → [B, C, D] → Aggregator
 * - Conditional Composition: A → (condition) → B or C
 * - Iterative Composition: A → (check) → A → ... → Done
 * - Dataflow Mapping: JSONPath-like expressions
 * - Aggregation Strategies: merge, array, first, custom
 * - Dependency Resolution with fallbacks
 * - Timeout handling
 * - Circular dependency detection
 */

import type {
  CognitiveModule,
  ModuleResult,
  ModuleInput,
  Provider,
  EnvelopeResponseV22,
  EnvelopeMeta,
  RiskLevel
} from '../types.js';
import { loadModule, findModule, getDefaultSearchPaths } from './loader.js';
import { runModule } from './runner.js';
import { isV22Envelope, aggregateRisk } from '../types.js';

// =============================================================================
// Composition Types
// =============================================================================

/** Composition pattern types */
export type CompositionPattern = 'sequential' | 'parallel' | 'conditional' | 'iterative';

/** Aggregation strategy for combining multiple outputs */
export type AggregationStrategy = 'merge' | 'array' | 'first' | 'custom';

/** Semver-like version matching pattern */
export type VersionPattern = string; // e.g., ">=1.0.0", "^1.0.0", "~1.0.0", "*"

/** Dependency declaration for composition.requires */
export interface DependencyDeclaration {
  /** Module name */
  name: string;
  /** Semver version pattern */
  version?: VersionPattern;
  /** Whether dependency is optional */
  optional?: boolean;
  /** Fallback module if unavailable */
  fallback?: string | null;
  /** Per-module timeout (ms) */
  timeout_ms?: number;
}

/** Dataflow mapping expression */
export interface DataflowMapping {
  [key: string]: string; // target_field: "$.source.path"
}

/** Condition expression for routing */
export interface ConditionExpression {
  expression: string; // e.g., "$.meta.confidence > 0.7"
}

/** Dataflow step configuration */
export interface DataflowStep {
  /** Source of data: 'input' or 'module-name.output' */
  from: string | string[];
  /** Destination: module name or 'output' */
  to: string | string[];
  /** Field mapping expressions */
  mapping?: DataflowMapping;
  /** Condition for execution */
  condition?: string;
  /** Aggregation strategy when from is an array */
  aggregate?: AggregationStrategy;
  /** Custom aggregation function name */
  aggregator?: string;
}

/** Conditional routing rule */
export interface RoutingRule {
  /** Condition expression */
  condition: string;
  /** Next module to execute (null means use current result) */
  next: string | null;
}

/** Full composition configuration (from module.yaml) */
export interface CompositionConfig {
  /** Composition pattern */
  pattern: CompositionPattern;
  /** Required dependencies */
  requires?: DependencyDeclaration[];
  /** Dataflow configuration */
  dataflow?: DataflowStep[];
  /** Conditional routing rules */
  routing?: RoutingRule[];
  /** Maximum composition depth */
  max_depth?: number;
  /** Total timeout for composition (ms) */
  timeout_ms?: number;
  /** Iteration configuration */
  iteration?: {
    /** Maximum iterations */
    max_iterations?: number;
    /** Condition to continue iterating */
    continue_condition?: string;
    /** Condition to stop iterating */
    stop_condition?: string;
  };
}

/** Execution context for composition */
export interface CompositionContext {
  /** Current execution depth */
  depth: number;
  /** Maximum allowed depth */
  maxDepth: number;
  /** Results from completed modules */
  results: Record<string, ModuleResult>;
  /** Original input data */
  input: ModuleInput;
  /** Currently running modules (for circular detection) */
  running: Set<string>;
  /** Start time for timeout tracking */
  startTime: number;
  /** Total timeout (ms) */
  timeoutMs?: number;
  /** Iteration count (for iterative composition) */
  iterationCount: number;
}

/** Result of composition execution */
export interface CompositionResult {
  /** Whether composition succeeded */
  ok: boolean;
  /** Final aggregated result */
  result?: ModuleResult;
  /** Results from all executed modules */
  moduleResults: Record<string, ModuleResult>;
  /** Execution trace for debugging */
  trace: ExecutionTrace[];
  /** Total execution time (ms) */
  totalTimeMs: number;
  /** Error if composition failed */
  error?: {
    code: string;
    message: string;
    module?: string;
  };
}

/** Execution trace entry */
export interface ExecutionTrace {
  module: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  success: boolean;
  skipped?: boolean;
  reason?: string;
}

// =============================================================================
// Error Codes for Composition
// =============================================================================

export const COMPOSITION_ERRORS = {
  E4004: 'CIRCULAR_DEPENDENCY',
  E4005: 'MAX_DEPTH_EXCEEDED',
  E4008: 'COMPOSITION_TIMEOUT',
  E4009: 'DEPENDENCY_NOT_FOUND',
  E4010: 'DATAFLOW_ERROR',
  E4011: 'CONDITION_EVAL_ERROR',
  E4012: 'AGGREGATION_ERROR',
  E4013: 'ITERATION_LIMIT_EXCEEDED',
} as const;

// =============================================================================
// JSONPath-like Expression Parser
// =============================================================================

/**
 * Parse and evaluate JSONPath-like expressions.
 * 
 * Supported syntax:
 * - $.field - Root field access
 * - $.nested.field - Nested access
 * - $.array[0] - Array index
 * - $.array[*].field - Array map
 * - $ - Entire object
 */
export function evaluateJsonPath(expression: string, data: unknown): unknown {
  if (!expression.startsWith('$')) {
    return expression; // Literal value
  }
  
  if (expression === '$') {
    return data;
  }
  
  const path = expression.slice(1); // Remove leading $
  const segments = parsePathSegments(path);
  
  let current: unknown = data;
  
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    
    if (segment.type === 'field' && segment.name !== undefined) {
      if (typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[segment.name];
    } else if (segment.type === 'index' && segment.index !== undefined) {
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[segment.index];
    } else if (segment.type === 'wildcard') {
      if (!Array.isArray(current)) {
        return undefined;
      }
      // Map over array
      const remainingSegments = segment.remaining ?? [];
      current = current.map(item => {
        let result: unknown = item;
        for (const remainingSegment of remainingSegments) {
          if (result === null || result === undefined) {
            return undefined;
          }
          if (remainingSegment.type === 'field' && remainingSegment.name !== undefined) {
            result = (result as Record<string, unknown>)[remainingSegment.name];
          }
        }
        return result;
      });
      break; // Wildcard consumes remaining path
    }
  }
  
  return current;
}

interface PathSegment {
  type: 'field' | 'index' | 'wildcard';
  name?: string;
  index?: number;
  remaining?: PathSegment[];
}

function parsePathSegments(path: string): PathSegment[] {
  const segments: PathSegment[] = [];
  let remaining = path;
  
  while (remaining.length > 0) {
    // Remove leading dot
    if (remaining.startsWith('.')) {
      remaining = remaining.slice(1);
    }
    
    // Array index: [0]
    const indexMatch = remaining.match(/^\[(\d+)\]/);
    if (indexMatch) {
      segments.push({ type: 'index', index: parseInt(indexMatch[1], 10) });
      remaining = remaining.slice(indexMatch[0].length);
      continue;
    }
    
    // Array wildcard: [*]
    const wildcardMatch = remaining.match(/^\[\*\]/);
    if (wildcardMatch) {
      remaining = remaining.slice(wildcardMatch[0].length);
      // Parse remaining path for wildcard
      const remainingSegments = parsePathSegments(remaining);
      segments.push({ type: 'wildcard', remaining: remainingSegments });
      break; // Wildcard consumes the rest
    }
    
    // Field name (support hyphens in field names like quick-check)
    const fieldMatch = remaining.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)/);
    if (fieldMatch) {
      segments.push({ type: 'field', name: fieldMatch[1] });
      remaining = remaining.slice(fieldMatch[0].length);
      continue;
    }
    
    // Unknown segment, break
    break;
  }
  
  return segments;
}

/**
 * Apply dataflow mapping to transform data
 */
export function applyMapping(
  mapping: DataflowMapping,
  sourceData: unknown
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [targetField, sourceExpr] of Object.entries(mapping)) {
    result[targetField] = evaluateJsonPath(sourceExpr, sourceData);
  }
  
  return result;
}

// =============================================================================
// Condition Expression Evaluator
// =============================================================================

/**
 * Evaluate condition expressions.
 * 
 * Supported operators:
 * - Comparison: ==, !=, >, <, >=, <=
 * - Logical: &&, ||, !
 * - Existence: exists($.field)
 * - String: contains($.field, "value")
 */
export function evaluateCondition(expression: string, data: unknown): boolean {
  try {
    // Handle exists() function
    const existsMatch = expression.match(/exists\(([^)]+)\)/);
    if (existsMatch) {
      const value = evaluateJsonPath(existsMatch[1].trim(), data);
      const exists = value !== undefined && value !== null;
      const remainingExpr = expression.replace(existsMatch[0], exists ? 'true' : 'false');
      if (remainingExpr.trim() === 'true' || remainingExpr.trim() === 'false') {
        return remainingExpr.trim() === 'true';
      }
      return evaluateCondition(remainingExpr, data);
    }
    
    // Handle contains() function - supports both string and array
    const containsMatch = expression.match(/contains\(([^,]+),\s*["']([^"']+)["']\)/);
    if (containsMatch) {
      const value = evaluateJsonPath(containsMatch[1].trim(), data);
      const search = containsMatch[2];
      let contains = false;
      if (typeof value === 'string') {
        contains = value.includes(search);
      } else if (Array.isArray(value)) {
        contains = value.includes(search);
      }
      const remainingExpr = expression.replace(containsMatch[0], contains ? 'true' : 'false');
      return evaluateCondition(remainingExpr, data);
    }
    
    // Handle length property (support hyphens in field names)
    const lengthMatch = expression.match(/(\$[a-zA-Z0-9._\[\]*-]+)\.length/g);
    if (lengthMatch) {
      let processedExpr = expression;
      for (const match of lengthMatch) {
        const pathPart = match.replace('.length', '');
        const value = evaluateJsonPath(pathPart, data);
        const length = Array.isArray(value) ? value.length : 
                       typeof value === 'string' ? value.length : 0;
        processedExpr = processedExpr.replace(match, String(length));
      }
      expression = processedExpr;
    }
    
    // Replace JSONPath expressions with values (support hyphens in field names)
    const jsonPathMatches = expression.match(/\$[a-zA-Z0-9._\[\]*-]+/g);
    if (jsonPathMatches) {
      let processedExpr = expression;
      for (const match of jsonPathMatches) {
        const value = evaluateJsonPath(match, data);
        let replacement: string;
        
        if (value === undefined || value === null) {
          replacement = 'null';
        } else if (typeof value === 'string') {
          replacement = `"${value}"`;
        } else if (typeof value === 'boolean') {
          replacement = value ? 'true' : 'false';
        } else if (typeof value === 'number') {
          replacement = String(value);
        } else {
          replacement = JSON.stringify(value);
        }
        
        processedExpr = processedExpr.replace(match, replacement);
      }
      expression = processedExpr;
    }
    
    // Evaluate the expression safely
    return safeEval(expression);
  } catch (error) {
    console.error(`Failed to evaluate condition: ${expression}`, error);
    return false;
  }
}

/**
 * Safe expression evaluator (no eval())
 */
function safeEval(expression: string): boolean {
  // Remove whitespace
  expression = expression.trim();
  
  // Handle logical operators (lowest precedence)
  // Handle || first
  const orParts = splitByOperator(expression, '||');
  if (orParts.length > 1) {
    return orParts.some(part => safeEval(part));
  }
  
  // Handle &&
  const andParts = splitByOperator(expression, '&&');
  if (andParts.length > 1) {
    return andParts.every(part => safeEval(part));
  }
  
  // Handle ! (not)
  if (expression.startsWith('!')) {
    return !safeEval(expression.slice(1));
  }
  
  // Handle parentheses
  if (expression.startsWith('(') && expression.endsWith(')')) {
    return safeEval(expression.slice(1, -1));
  }
  
  // Handle comparison operators
  const comparisonOps = ['!==', '===', '!=', '==', '>=', '<=', '>', '<'];
  for (const op of comparisonOps) {
    const opIndex = expression.indexOf(op);
    if (opIndex !== -1) {
      const left = parseValue(expression.slice(0, opIndex).trim());
      const right = parseValue(expression.slice(opIndex + op.length).trim());
      
      switch (op) {
        case '===':
        case '==':
          return left === right;
        case '!==':
        case '!=':
          return left !== right;
        case '>':
          return (left as number) > (right as number);
        case '<':
          return (left as number) < (right as number);
        case '>=':
          return (left as number) >= (right as number);
        case '<=':
          return (left as number) <= (right as number);
      }
    }
  }
  
  // Handle boolean literals
  if (expression === 'true') return true;
  if (expression === 'false') return false;
  
  // Handle truthy/falsy
  const value = parseValue(expression);
  return Boolean(value);
}

function splitByOperator(expression: string, operator: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < expression.length; i++) {
    const char = expression[i];
    
    // Handle string literals
    if ((char === '"' || char === "'") && expression[i - 1] !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }
    
    // Handle parentheses depth
    if (!inString) {
      if (char === '(') depth++;
      if (char === ')') depth--;
    }
    
    // Check for operator
    if (!inString && depth === 0 && expression.slice(i, i + operator.length) === operator) {
      parts.push(current.trim());
      current = '';
      i += operator.length - 1;
      continue;
    }
    
    current += char;
  }
  
  if (current.trim()) {
    parts.push(current.trim());
  }
  
  return parts;
}

function parseValue(str: string): unknown {
  str = str.trim();
  
  // Null
  if (str === 'null') return null;
  
  // Boolean
  if (str === 'true') return true;
  if (str === 'false') return false;
  
  // String (quoted)
  if ((str.startsWith('"') && str.endsWith('"')) || 
      (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  
  // Number
  const num = Number(str);
  if (!isNaN(num)) return num;
  
  // Return as string
  return str;
}

// =============================================================================
// Aggregation Strategies
// =============================================================================

/**
 * Deep merge two objects (later wins on conflict)
 */
function deepMerge(target: unknown, source: unknown): unknown {
  if (source === null || source === undefined) {
    return target;
  }
  
  if (typeof source !== 'object' || typeof target !== 'object') {
    return source;
  }
  
  if (Array.isArray(source)) {
    return source;
  }
  
  const result: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (key in result && typeof result[key] === 'object' && typeof value === 'object') {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Aggregate multiple results using specified strategy
 */
export function aggregateResults(
  results: ModuleResult[],
  strategy: AggregationStrategy
): ModuleResult {
  if (results.length === 0) {
    return {
      ok: false,
      meta: { confidence: 0, risk: 'high', explain: 'No results to aggregate' },
      error: { code: 'E4012', message: 'No results to aggregate' }
    } as ModuleResult;
  }
  
  if (results.length === 1) {
    return results[0];
  }
  
  switch (strategy) {
    case 'first': {
      // Return first non-null successful result
      const firstSuccess = results.find(r => r.ok);
      return firstSuccess ?? results[0];
    }
    
    case 'array': {
      // Collect all results into an array
      const allData = results
        .filter(r => r.ok && 'data' in r)
        .map(r => (r as { data: unknown }).data);
      
      const allMeta = results
        .filter(r => 'meta' in r)
        .map(r => (r as { meta: EnvelopeMeta }).meta);
      
      // Compute aggregate meta
      const avgConfidence = allMeta.length > 0
        ? allMeta.reduce((sum, m) => sum + m.confidence, 0) / allMeta.length
        : 0.5;
      
      const maxRisk = allMeta.length > 0
        ? (['none', 'low', 'medium', 'high'] as RiskLevel[])[
            Math.max(...allMeta.map(m => 
              ['none', 'low', 'medium', 'high'].indexOf(m.risk)
            ))
          ]
        : 'medium';
      
      return {
        ok: true,
        meta: {
          confidence: avgConfidence,
          risk: maxRisk,
          explain: `Aggregated ${allData.length} results`
        },
        data: {
          results: allData,
          rationale: `Combined ${allData.length} module outputs into array`
        }
      } as ModuleResult;
    }
    
    case 'merge':
    default: {
      // Deep merge all results (later wins)
      let mergedData: unknown = {};
      let mergedMeta: EnvelopeMeta = {
        confidence: 0.5,
        risk: 'medium',
        explain: ''
      };
      
      const explains: string[] = [];
      let totalConfidence = 0;
      let maxRiskLevel = 0;
      const riskLevels: Record<RiskLevel, number> = { none: 0, low: 1, medium: 2, high: 3 };
      const riskNames: RiskLevel[] = ['none', 'low', 'medium', 'high'];
      
      for (const result of results) {
        if (result.ok && 'data' in result) {
          mergedData = deepMerge(mergedData, (result as { data: unknown }).data);
        }
        
        if ('meta' in result) {
          const meta = (result as { meta: EnvelopeMeta }).meta;
          totalConfidence += meta.confidence;
          maxRiskLevel = Math.max(maxRiskLevel, riskLevels[meta.risk] ?? 2);
          if (meta.explain) {
            explains.push(meta.explain);
          }
        }
      }
      
      mergedMeta = {
        confidence: totalConfidence / results.length,
        risk: riskNames[maxRiskLevel],
        explain: explains.join('; ').slice(0, 280)
      };
      
      return {
        ok: true,
        meta: mergedMeta,
        data: {
          ...(mergedData as Record<string, unknown>),
          rationale: `Merged ${results.length} module outputs`
        }
      } as ModuleResult;
    }
  }
}

// =============================================================================
// Dependency Resolution
// =============================================================================

/**
 * Check if version matches pattern (simplified semver)
 */
export function versionMatches(version: string, pattern: string): boolean {
  if (!pattern || pattern === '*') {
    return true;
  }
  
  // Parse version into parts
  const parseVersion = (v: string): number[] => {
    return v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  };
  
  const vParts = parseVersion(version);
  
  // Exact match
  if (!pattern.startsWith('^') && !pattern.startsWith('~') && !pattern.startsWith('>') && !pattern.startsWith('<')) {
    const pParts = parseVersion(pattern);
    return vParts[0] === pParts[0] && vParts[1] === pParts[1] && vParts[2] === pParts[2];
  }
  
  // >= match
  if (pattern.startsWith('>=')) {
    const pParts = parseVersion(pattern.slice(2));
    for (let i = 0; i < 3; i++) {
      if (vParts[i] > pParts[i]) return true;
      if (vParts[i] < pParts[i]) return false;
    }
    return true;
  }
  
  // > match
  if (pattern.startsWith('>') && !pattern.startsWith('>=')) {
    const pParts = parseVersion(pattern.slice(1));
    for (let i = 0; i < 3; i++) {
      if (vParts[i] > pParts[i]) return true;
      if (vParts[i] < pParts[i]) return false;
    }
    return false;
  }
  
  // ^ (compatible) - same major
  if (pattern.startsWith('^')) {
    const pParts = parseVersion(pattern.slice(1));
    return vParts[0] === pParts[0] && 
           (vParts[1] > pParts[1] || (vParts[1] === pParts[1] && vParts[2] >= pParts[2]));
  }
  
  // ~ (patch only) - same major.minor
  if (pattern.startsWith('~')) {
    const pParts = parseVersion(pattern.slice(1));
    return vParts[0] === pParts[0] && vParts[1] === pParts[1] && vParts[2] >= pParts[2];
  }
  
  return true;
}

/**
 * Resolve a dependency, checking version and trying fallbacks
 */
export async function resolveDependency(
  dep: DependencyDeclaration,
  searchPaths: string[]
): Promise<CognitiveModule | null> {
  // Try primary module
  const module = await findModule(dep.name, searchPaths);
  
  if (module) {
    // Check version if specified
    if (dep.version && !versionMatches(module.version, dep.version)) {
      console.warn(`Module ${dep.name} version ${module.version} does not match ${dep.version}`);
      if (!dep.optional) {
        // Try fallback
        if (dep.fallback) {
          return findModule(dep.fallback, searchPaths);
        }
        return null;
      }
    }
    return module;
  }
  
  // Try fallback
  if (dep.fallback) {
    return findModule(dep.fallback, searchPaths);
  }
  
  // Optional dependency not found
  if (dep.optional) {
    return null;
  }
  
  throw new Error(`Required dependency not found: ${dep.name}`);
}

// =============================================================================
// Composition Orchestrator
// =============================================================================

export class CompositionOrchestrator {
  private provider: Provider;
  private cwd: string;
  private searchPaths: string[];
  
  constructor(provider: Provider, cwd: string = process.cwd()) {
    this.provider = provider;
    this.cwd = cwd;
    this.searchPaths = getDefaultSearchPaths(cwd);
  }
  
  /**
   * Execute a composed module workflow
   */
  async execute(
    moduleName: string,
    input: ModuleInput,
    options: {
      maxDepth?: number;
      timeoutMs?: number;
    } = {}
  ): Promise<CompositionResult> {
    const startTime = Date.now();
    const trace: ExecutionTrace[] = [];
    const moduleResults: Record<string, ModuleResult> = {};
    
    // Create context
    const context: CompositionContext = {
      depth: 0,
      maxDepth: options.maxDepth ?? 5,
      results: {},
      input,
      running: new Set(),
      startTime,
      timeoutMs: options.timeoutMs,
      iterationCount: 0
    };
    
    try {
      // Load the main module
      const module = await findModule(moduleName, this.searchPaths);
      if (!module) {
        return {
          ok: false,
          moduleResults: {},
          trace: [],
          totalTimeMs: Date.now() - startTime,
          error: {
            code: COMPOSITION_ERRORS.E4009,
            message: `Module not found: ${moduleName}`
          }
        };
      }
      
      // Check if module has composition config
      const composition = this.getCompositionConfig(module);
      
      let result: ModuleResult;
      
      if (composition) {
        // Execute composition workflow
        result = await this.executeComposition(module, composition, context, trace);
      } else {
        // Simple execution (no composition)
        result = await this.executeModule(module, input, context, trace);
      }
      
      // Collect all results
      for (const [name, res] of Object.entries(context.results)) {
        moduleResults[name] = res as ModuleResult;
      }
      moduleResults[moduleName] = result;
      
      return {
        ok: result.ok,
        result,
        moduleResults,
        trace,
        totalTimeMs: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        ok: false,
        moduleResults,
        trace,
        totalTimeMs: Date.now() - startTime,
        error: {
          code: 'E4000',
          message: (error as Error).message
        }
      };
    }
  }
  
  /**
   * Get composition config from module (if exists)
   */
  private getCompositionConfig(module: CognitiveModule): CompositionConfig | null {
    // Check if module has composition in its metadata
    const raw = (module as unknown as { composition?: CompositionConfig }).composition;
    return raw ?? null;
  }
  
  /**
   * Execute composition based on pattern
   */
  private async executeComposition(
    module: CognitiveModule,
    composition: CompositionConfig,
    context: CompositionContext,
    trace: ExecutionTrace[]
  ): Promise<ModuleResult> {
    // Check timeout
    if (this.isTimedOut(context)) {
      return this.timeoutError(context);
    }
    
    // Check depth
    if (context.depth > context.maxDepth) {
      return {
        ok: false,
        meta: { confidence: 0, risk: 'high', explain: 'Max composition depth exceeded' },
        error: { code: COMPOSITION_ERRORS.E4005, message: `Maximum composition depth (${context.maxDepth}) exceeded` }
      } as ModuleResult;
    }
    
    // Resolve dependencies first
    if (composition.requires) {
      for (const dep of composition.requires) {
        const resolved = await resolveDependency(dep, this.searchPaths);
        if (!resolved && !dep.optional) {
          return {
            ok: false,
            meta: { confidence: 0, risk: 'high', explain: `Dependency not found: ${dep.name}` },
            error: { code: COMPOSITION_ERRORS.E4009, message: `Required dependency not found: ${dep.name}` }
          } as ModuleResult;
        }
      }
    }
    
    // Execute based on pattern
    switch (composition.pattern) {
      case 'sequential':
        return this.executeSequential(module, composition, context, trace);
      
      case 'parallel':
        return this.executeParallel(module, composition, context, trace);
      
      case 'conditional':
        return this.executeConditional(module, composition, context, trace);
      
      case 'iterative':
        return this.executeIterative(module, composition, context, trace);
      
      default:
        // Default to sequential
        return this.executeSequential(module, composition, context, trace);
    }
  }
  
  /**
   * Execute sequential composition: A → B → C
   */
  private async executeSequential(
    module: CognitiveModule,
    composition: CompositionConfig,
    context: CompositionContext,
    trace: ExecutionTrace[]
  ): Promise<ModuleResult> {
    const dataflow = composition.dataflow ?? [];
    let currentData: unknown = context.input;
    let lastResult: ModuleResult | null = null;
    
    for (const step of dataflow) {
      // Check timeout
      if (this.isTimedOut(context)) {
        return this.timeoutError(context);
      }
      
      // Check condition
      if (step.condition) {
        const conditionData = {
          input: context.input,
          ...context.results,
          current: currentData
        };
        
        if (!evaluateCondition(step.condition, conditionData)) {
          trace.push({
            module: Array.isArray(step.to) ? step.to.join(',') : step.to,
            startTime: Date.now(),
            endTime: Date.now(),
            durationMs: 0,
            success: true,
            skipped: true,
            reason: `Condition not met: ${step.condition}`
          });
          continue;
        }
      }
      
      // Get source data
      const sources = Array.isArray(step.from) ? step.from : [step.from];
      const sourceDataArray: unknown[] = [];
      
      for (const source of sources) {
        if (source === 'input') {
          sourceDataArray.push(context.input);
        } else if (source.endsWith('.output')) {
          const moduleName = source.replace('.output', '');
          const moduleResult = context.results[moduleName];
          if (moduleResult && 'data' in moduleResult) {
            sourceDataArray.push((moduleResult as { data: unknown }).data);
          }
        } else {
          // Assume it's a module name
          const moduleResult = context.results[source];
          if (moduleResult && 'data' in moduleResult) {
            sourceDataArray.push((moduleResult as { data: unknown }).data);
          }
        }
      }
      
      // Aggregate sources if multiple
      let sourceData: unknown;
      if (sourceDataArray.length === 1) {
        sourceData = sourceDataArray[0];
      } else if (sourceDataArray.length > 1) {
        sourceData = { sources: sourceDataArray };
      } else {
        sourceData = currentData;
      }
      
      // Apply mapping
      if (step.mapping) {
        currentData = applyMapping(step.mapping, sourceData);
      } else {
        currentData = sourceData;
      }
      
      // Execute target(s)
      const targets = Array.isArray(step.to) ? step.to : [step.to];
      
      if (targets.length === 1 && targets[0] === 'output') {
        // Final output, no module to execute
        continue;
      }
      
      for (const target of targets) {
        if (target === 'output') continue;
        
        // Find and execute target module
        const targetModule = await findModule(target, this.searchPaths);
        if (!targetModule) {
          return {
            ok: false,
            meta: { confidence: 0, risk: 'high', explain: `Target module not found: ${target}` },
            error: { code: COMPOSITION_ERRORS.E4009, message: `Module not found: ${target}` }
          } as ModuleResult;
        }
        
        // Get timeout for this dependency
        const depConfig = composition.requires?.find(d => d.name === target);
        const depTimeout = depConfig?.timeout_ms;
        
        // Execute with timeout
        lastResult = await this.executeModuleWithTimeout(
          targetModule,
          currentData as ModuleInput,
          context,
          trace,
          depTimeout
        );
        
        // Store result
        context.results[target] = lastResult;
        
        if (!lastResult.ok) {
          // Check if we should use fallback
          if (depConfig?.fallback) {
            const fallbackModule = await findModule(depConfig.fallback, this.searchPaths);
            if (fallbackModule) {
              lastResult = await this.executeModuleWithTimeout(
                fallbackModule,
                currentData as ModuleInput,
                context,
                trace,
                depTimeout
              );
              context.results[depConfig.fallback] = lastResult;
            }
          }
          
          if (!lastResult.ok && !depConfig?.optional) {
            return lastResult;
          }
        }
        
        // Update current data with result
        if (lastResult.ok && 'data' in lastResult) {
          currentData = (lastResult as { data: unknown }).data;
        }
      }
    }
    
    // Return last result or execute main module
    if (lastResult) {
      return lastResult;
    }
    
    // Execute the main module with composed input
    return this.executeModule(module, currentData as ModuleInput, context, trace);
  }
  
  /**
   * Execute parallel composition: A → [B, C, D] → Aggregator
   */
  private async executeParallel(
    module: CognitiveModule,
    composition: CompositionConfig,
    context: CompositionContext,
    trace: ExecutionTrace[]
  ): Promise<ModuleResult> {
    const dataflow = composition.dataflow ?? [];
    
    // Find parallel execution steps (where 'to' is an array)
    for (const step of dataflow) {
      if (this.isTimedOut(context)) {
        return this.timeoutError(context);
      }
      
      // Get source data
      let sourceData: unknown = context.input;
      if (step.from) {
        const sources = Array.isArray(step.from) ? step.from : [step.from];
        for (const source of sources) {
          if (source === 'input') {
            sourceData = context.input;
          } else {
            const moduleName = source.replace('.output', '');
            const moduleResult = context.results[moduleName];
            if (moduleResult && 'data' in moduleResult) {
              sourceData = (moduleResult as { data: unknown }).data;
            }
          }
        }
      }
      
      // Apply mapping
      if (step.mapping) {
        sourceData = applyMapping(step.mapping, sourceData);
      }
      
      // Get targets
      const targets = Array.isArray(step.to) ? step.to : [step.to];
      
      if (targets.every(t => t === 'output')) {
        continue;
      }
      
      // Execute targets in parallel
      const parallelPromises: Promise<ModuleResult>[] = [];
      const parallelModules: string[] = [];
      
      for (const target of targets) {
        if (target === 'output') continue;
        
        const targetModule = await findModule(target, this.searchPaths);
        if (!targetModule) {
          if (!composition.requires?.find(d => d.name === target)?.optional) {
            return {
              ok: false,
              meta: { confidence: 0, risk: 'high', explain: `Module not found: ${target}` },
              error: { code: COMPOSITION_ERRORS.E4009, message: `Module not found: ${target}` }
            } as ModuleResult;
          }
          continue;
        }
        
        const depConfig = composition.requires?.find(d => d.name === target);
        const depTimeout = depConfig?.timeout_ms;
        
        parallelModules.push(target);
        parallelPromises.push(
          this.executeModuleWithTimeout(
            targetModule,
            sourceData as ModuleInput,
            { ...context, running: new Set(context.running) },
            trace,
            depTimeout
          )
        );
      }
      
      // Wait for all parallel executions
      const parallelResults = await Promise.all(parallelPromises);
      
      // Store results
      for (let i = 0; i < parallelModules.length; i++) {
        context.results[parallelModules[i]] = parallelResults[i];
      }
      
      // Check for failures
      const failures = parallelResults.filter(r => !r.ok);
      if (failures.length > 0) {
        // Check if all failed modules are optional
        const allOptional = parallelModules.every((name, i) => {
          if (parallelResults[i].ok) return true;
          return composition.requires?.find(d => d.name === name)?.optional;
        });
        
        if (!allOptional) {
          return failures[0];
        }
      }
    }
    
    // Aggregate results
    const aggregateStep = dataflow.find(s => {
      const targets = Array.isArray(s.to) ? s.to : [s.to];
      return targets.includes('output');
    });
    
    if (aggregateStep && Array.isArray(aggregateStep.from)) {
      const resultsToAggregate: ModuleResult[] = [];
      
      for (const source of aggregateStep.from) {
        const moduleName = source.replace('.output', '');
        const result = context.results[moduleName];
        if (result) {
          resultsToAggregate.push(result);
        }
      }
      
      const strategy = aggregateStep.aggregate ?? 'merge';
      return aggregateResults(resultsToAggregate, strategy);
    }
    
    // Execute main module with all results
    return this.executeModule(module, context.input, context, trace);
  }
  
  /**
   * Execute conditional composition: A → (condition) → B or C
   */
  private async executeConditional(
    module: CognitiveModule,
    composition: CompositionConfig,
    context: CompositionContext,
    trace: ExecutionTrace[]
  ): Promise<ModuleResult> {
    const routing = composition.routing ?? [];
    
    // First, execute the initial module to get data for conditions
    const dataflow = composition.dataflow ?? [];
    let conditionData: unknown = context.input;
    
    // Execute initial steps
    for (const step of dataflow) {
      if (this.isTimedOut(context)) {
        return this.timeoutError(context);
      }
      
      const targets = Array.isArray(step.to) ? step.to : [step.to];
      
      // Execute non-routing targets
      for (const target of targets) {
        if (target === 'output') continue;
        
        // Check if this target is involved in routing
        const isRoutingTarget = routing.some(r => r.next === target);
        if (isRoutingTarget) continue;
        
        const targetModule = await findModule(target, this.searchPaths);
        if (!targetModule) continue;
        
        // Get source data
        let sourceData = context.input;
        if (step.from) {
          const source = Array.isArray(step.from) ? step.from[0] : step.from;
          if (source !== 'input') {
            const moduleName = source.replace('.output', '');
            const result = context.results[moduleName];
            if (result && 'data' in result) {
              sourceData = (result as { data: unknown }).data as ModuleInput;
            }
          }
        }
        
        if (step.mapping) {
          sourceData = applyMapping(step.mapping, sourceData) as ModuleInput;
        }
        
        const result = await this.executeModule(targetModule, sourceData, context, trace);
        context.results[target] = result;
        
        // Update condition data - include full result (meta + data) for routing conditions
        conditionData = {
          input: context.input,
          ...Object.fromEntries(
            Object.entries(context.results).map(([k, v]) => [
              k, 
              v // Keep full result including meta and data
            ])
          )
        };
      }
    }
    
    // Evaluate routing conditions
    // Build condition data with proper structure for accessing $.module-name.meta.confidence
    const routingConditionData = {
      input: context.input,
      ...Object.fromEntries(
        Object.entries(context.results).map(([k, v]) => [k, v])
      )
    };
    
    for (const rule of routing) {
      const matches = evaluateCondition(rule.condition, routingConditionData);
      
      if (matches) {
        if (rule.next === null) {
          // Use current result directly
          const lastResult = Object.values(context.results).pop();
          return lastResult ?? this.executeModule(module, context.input, context, trace);
        }
        
        // Execute the next module
        const nextModule = await findModule(rule.next, this.searchPaths);
        if (!nextModule) {
          return {
            ok: false,
            meta: { confidence: 0, risk: 'high', explain: `Routing target not found: ${rule.next}` },
            error: { code: COMPOSITION_ERRORS.E4009, message: `Module not found: ${rule.next}` }
          } as ModuleResult;
        }
        
        // Pass through the data
        let nextInput = context.input;
        const lastDataflowStep = dataflow[dataflow.length - 1];
        if (lastDataflowStep?.mapping) {
          nextInput = applyMapping(lastDataflowStep.mapping, conditionData) as ModuleInput;
        }
        
        return this.executeModule(nextModule, nextInput, context, trace);
      }
    }
    
    // No routing matched, execute main module
    return this.executeModule(module, context.input, context, trace);
  }
  
  /**
   * Execute iterative composition: A → (check) → A → ... → Done
   */
  private async executeIterative(
    module: CognitiveModule,
    composition: CompositionConfig,
    context: CompositionContext,
    trace: ExecutionTrace[]
  ): Promise<ModuleResult> {
    const maxIterations = composition.iteration?.max_iterations ?? 10;
    const continueCondition = composition.iteration?.continue_condition;
    const stopCondition = composition.iteration?.stop_condition;
    
    let currentInput = context.input;
    let lastResult: ModuleResult | null = null;
    let iteration = 0;
    
    while (iteration < maxIterations) {
      if (this.isTimedOut(context)) {
        return this.timeoutError(context);
      }
      
      // Execute the module
      lastResult = await this.executeModule(module, currentInput, context, trace);
      context.iterationCount = iteration + 1;
      
      // Store result with iteration number
      context.results[`${module.name}_iteration_${iteration}`] = lastResult;
      
      // Check stop condition
      if (stopCondition) {
        const stopData = {
          input: context.input,
          current: lastResult,
          iteration,
          meta: lastResult && 'meta' in lastResult ? (lastResult as { meta: unknown }).meta : null,
          data: lastResult && 'data' in lastResult ? (lastResult as { data: unknown }).data : null
        };
        
        if (evaluateCondition(stopCondition, stopData)) {
          break;
        }
      }
      
      // Check continue condition
      if (continueCondition) {
        const continueData = {
          input: context.input,
          current: lastResult,
          iteration,
          meta: lastResult && 'meta' in lastResult ? (lastResult as { meta: unknown }).meta : null,
          data: lastResult && 'data' in lastResult ? (lastResult as { data: unknown }).data : null
        };
        
        if (!evaluateCondition(continueCondition, continueData)) {
          break;
        }
      } else {
        // No continue condition and no stop condition - only run once
        break;
      }
      
      // Update input for next iteration
      if (lastResult.ok && 'data' in lastResult) {
        currentInput = (lastResult as { data: ModuleInput }).data;
      }
      
      iteration++;
    }
    
    // Check if we hit iteration limit
    if (iteration >= maxIterations && continueCondition) {
      return {
        ok: false,
        meta: { 
          confidence: 0.5, 
          risk: 'medium', 
          explain: `Iteration limit (${maxIterations}) reached` 
        },
        error: { 
          code: COMPOSITION_ERRORS.E4013, 
          message: `Maximum iterations (${maxIterations}) exceeded` 
        },
        partial_data: lastResult && 'data' in lastResult 
          ? (lastResult as { data: unknown }).data 
          : undefined
      } as ModuleResult;
    }
    
    return lastResult ?? {
      ok: false,
      meta: { confidence: 0, risk: 'high', explain: 'No iteration executed' },
      error: { code: 'E4000', message: 'Iterative composition produced no result' }
    } as ModuleResult;
  }
  
  /**
   * Execute a single module
   */
  private async executeModule(
    module: CognitiveModule,
    input: ModuleInput,
    context: CompositionContext,
    trace: ExecutionTrace[]
  ): Promise<ModuleResult> {
    // Check depth limit
    if (context.depth >= context.maxDepth) {
      return {
        ok: false,
        meta: { confidence: 0, risk: 'high', explain: `Max depth exceeded at ${module.name}` },
        error: { 
          code: COMPOSITION_ERRORS.E4005, 
          message: `Maximum composition depth (${context.maxDepth}) exceeded at module: ${module.name}` 
        }
      } as ModuleResult;
    }
    
    // Check for circular dependency
    if (context.running.has(module.name)) {
      trace.push({
        module: module.name,
        startTime: Date.now(),
        endTime: Date.now(),
        durationMs: 0,
        success: false,
        reason: 'Circular dependency detected'
      });
      
      return {
        ok: false,
        meta: { confidence: 0, risk: 'high', explain: `Circular dependency: ${module.name}` },
        error: { 
          code: COMPOSITION_ERRORS.E4004, 
          message: `Circular dependency detected: ${module.name}` 
        }
      } as ModuleResult;
    }
    
    context.running.add(module.name);
    context.depth++; // Increment depth when entering module
    const startTime = Date.now();
    
    try {
      const result = await runModule(module, this.provider, {
        input,
        validateInput: true,
        validateOutput: true,
        useV22: true
      });
      
      const endTime = Date.now();
      trace.push({
        module: module.name,
        startTime,
        endTime,
        durationMs: endTime - startTime,
        success: result.ok
      });
      
      return result;
      
    } catch (error) {
      const endTime = Date.now();
      trace.push({
        module: module.name,
        startTime,
        endTime,
        durationMs: endTime - startTime,
        success: false,
        reason: (error as Error).message
      });
      
      return {
        ok: false,
        meta: { confidence: 0, risk: 'high', explain: (error as Error).message.slice(0, 280) },
        error: { code: 'E4000', message: (error as Error).message }
      } as ModuleResult;
      
    } finally {
      context.running.delete(module.name);
      context.depth--; // Decrement depth when exiting module
    }
  }
  
  /**
   * Execute module with timeout
   */
  private async executeModuleWithTimeout(
    module: CognitiveModule,
    input: ModuleInput,
    context: CompositionContext,
    trace: ExecutionTrace[],
    timeoutMs?: number
  ): Promise<ModuleResult> {
    const timeout = timeoutMs ?? context.timeoutMs;
    
    if (!timeout) {
      return this.executeModule(module, input, context, trace);
    }
    
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    const timeoutPromise = new Promise<ModuleResult>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Module ${module.name} timed out after ${timeout}ms`));
      }, timeout);
    });
    
    try {
      const result = await Promise.race([
        this.executeModule(module, input, context, trace),
        timeoutPromise
      ]);
      // Clear timeout on success to prevent memory leak
      if (timeoutId) clearTimeout(timeoutId);
      return result;
    } catch (error) {
      // Clear timeout on error too
      if (timeoutId) clearTimeout(timeoutId);
      return {
        ok: false,
        meta: { confidence: 0, risk: 'high', explain: `Timeout: ${module.name}` },
        error: { 
          code: COMPOSITION_ERRORS.E4008, 
          message: (error as Error).message 
        }
      } as ModuleResult;
    }
  }
  
  /**
   * Check if composition has timed out
   */
  private isTimedOut(context: CompositionContext): boolean {
    if (!context.timeoutMs) return false;
    return Date.now() - context.startTime > context.timeoutMs;
  }
  
  /**
   * Create timeout error response
   */
  private timeoutError(context: CompositionContext): ModuleResult {
    const elapsed = Date.now() - context.startTime;
    return {
      ok: false,
      meta: { 
        confidence: 0, 
        risk: 'high', 
        explain: `Composition timed out after ${elapsed}ms` 
      },
      error: { 
        code: COMPOSITION_ERRORS.E4008, 
        message: `Composition timeout: ${elapsed}ms exceeded ${context.timeoutMs}ms limit` 
      }
    } as ModuleResult;
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Execute a composed module workflow
 */
export async function executeComposition(
  moduleName: string,
  input: ModuleInput,
  provider: Provider,
  options: {
    cwd?: string;
    maxDepth?: number;
    timeoutMs?: number;
  } = {}
): Promise<CompositionResult> {
  const { cwd = process.cwd(), ...execOptions } = options;
  const orchestrator = new CompositionOrchestrator(provider, cwd);
  return orchestrator.execute(moduleName, input, execOptions);
}

/**
 * Validate composition configuration
 */
export function validateCompositionConfig(config: CompositionConfig): { 
  valid: boolean; 
  errors: string[] 
} {
  const errors: string[] = [];
  
  // Check pattern
  const validPatterns: CompositionPattern[] = ['sequential', 'parallel', 'conditional', 'iterative'];
  if (!validPatterns.includes(config.pattern)) {
    errors.push(`Invalid pattern: ${config.pattern}. Must be one of: ${validPatterns.join(', ')}`);
  }
  
  // Check dataflow steps
  if (config.dataflow) {
    for (let i = 0; i < config.dataflow.length; i++) {
      const step = config.dataflow[i];
      if (!step.from) {
        errors.push(`Dataflow step ${i}: missing 'from' field`);
      }
      if (!step.to) {
        errors.push(`Dataflow step ${i}: missing 'to' field`);
      }
    }
  }
  
  // Check routing rules for conditional pattern
  if (config.pattern === 'conditional' && (!config.routing || config.routing.length === 0)) {
    errors.push('Conditional pattern requires routing rules');
  }
  
  // Check iteration config for iterative pattern
  if (config.pattern === 'iterative') {
    const iter = config.iteration;
    if (!iter?.continue_condition && !iter?.stop_condition) {
      errors.push('Iterative pattern requires either continue_condition or stop_condition');
    }
  }
  
  // Check dependencies
  if (config.requires) {
    for (const dep of config.requires) {
      if (!dep.name) {
        errors.push('Dependency missing name');
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
