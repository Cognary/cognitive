/**
 * Subagent - Orchestrate module calls with isolated execution contexts.
 * 
 * Supports:
 * - @call:module-name - Call another module
 * - @call:module-name(args) - Call with arguments
 * - context: fork - Isolated execution (no shared state)
 * - context: main - Shared execution (default)
 */

import type { 
  CognitiveModule, 
  ModuleResult, 
  ModuleInput,
  Provider,
  EnvelopeResponseV22
} from '../types.js';
import { loadModule, findModule, getDefaultSearchPaths } from './loader.js';
import { runModule } from './runner.js';

// =============================================================================
// Types
// =============================================================================

export interface SubagentContext {
  parentId: string | null;
  depth: number;
  maxDepth: number;
  results: Record<string, unknown>;
  isolated: boolean;
}

export interface CallDirective {
  module: string;
  args: string;
  match: string;
}

export interface SubagentRunOptions {
  input?: ModuleInput;
  validateInput?: boolean;
  validateOutput?: boolean;
  maxDepth?: number;
}

// =============================================================================
// Context Management
// =============================================================================

/**
 * Create a new root context
 */
export function createContext(maxDepth: number = 5): SubagentContext {
  return {
    parentId: null,
    depth: 0,
    maxDepth,
    results: {},
    isolated: false
  };
}

/**
 * Fork context (isolated - no inherited results)
 */
export function forkContext(ctx: SubagentContext, moduleName: string): SubagentContext {
  return {
    parentId: moduleName,
    depth: ctx.depth + 1,
    maxDepth: ctx.maxDepth,
    results: {},
    isolated: true
  };
}

/**
 * Extend context (shared - inherits results)
 */
export function extendContext(ctx: SubagentContext, moduleName: string): SubagentContext {
  return {
    parentId: moduleName,
    depth: ctx.depth + 1,
    maxDepth: ctx.maxDepth,
    results: { ...ctx.results },
    isolated: false
  };
}

// =============================================================================
// Call Parsing
// =============================================================================

// Pattern to match @call:module-name or @call:module-name(args)
const CALL_PATTERN = /@call:([a-zA-Z0-9_-]+)(?:\(([^)]*)\))?/g;

/**
 * Parse @call directives from text
 */
export function parseCalls(text: string): CallDirective[] {
  const calls: CallDirective[] = [];
  let match: RegExpExecArray | null;
  
  // Reset regex state
  CALL_PATTERN.lastIndex = 0;
  
  while ((match = CALL_PATTERN.exec(text)) !== null) {
    calls.push({
      module: match[1],
      args: match[2] || '',
      match: match[0]
    });
  }
  
  return calls;
}

/**
 * Replace @call directives with their results
 */
export function substituteCallResults(
  text: string, 
  callResults: Record<string, unknown>
): string {
  let result = text;
  
  for (const [callStr, callResult] of Object.entries(callResults)) {
    const resultStr = typeof callResult === 'object' 
      ? JSON.stringify(callResult, null, 2)
      : String(callResult);
    
    result = result.replace(callStr, `[Result from ${callStr}]:\n${resultStr}`);
  }
  
  return result;
}

// =============================================================================
// Orchestrator
// =============================================================================

export class SubagentOrchestrator {
  private provider: Provider;
  private running: Set<string> = new Set();
  private cwd: string;
  
  constructor(provider: Provider, cwd: string = process.cwd()) {
    this.provider = provider;
    this.cwd = cwd;
  }
  
  /**
   * Run a module with subagent support.
   * Recursively resolves @call directives before final execution.
   */
  async run(
    moduleName: string,
    options: SubagentRunOptions = {},
    context?: SubagentContext
  ): Promise<ModuleResult> {
    const { 
      input = {}, 
      validateInput = true, 
      validateOutput = true,
      maxDepth = 5
    } = options;
    
    // Initialize context
    const ctx = context ?? createContext(maxDepth);
    
    // Check depth limit
    if (ctx.depth > ctx.maxDepth) {
      throw new Error(
        `Max subagent depth (${ctx.maxDepth}) exceeded. Check for circular calls.`
      );
    }
    
    // Prevent circular calls
    if (this.running.has(moduleName)) {
      throw new Error(`Circular call detected: ${moduleName}`);
    }
    
    this.running.add(moduleName);
    
    try {
      // Find and load module
      const searchPaths = getDefaultSearchPaths(this.cwd);
      const module = await findModule(moduleName, searchPaths);
      
      if (!module) {
        throw new Error(`Module not found: ${moduleName}`);
      }
      
      // Check if this module wants isolated execution
      const moduleContextMode = module.context ?? 'main';
      
      // Parse @call directives from prompt
      const calls = parseCalls(module.prompt);
      const callResults: Record<string, unknown> = {};
      
      // Resolve each @call directive
      for (const call of calls) {
        const childModule = call.module;
        const childArgs = call.args;
        
        // Prepare child input
        const childInput: ModuleInput = childArgs 
          ? { query: childArgs, code: childArgs }
          : { ...input };
        
        // Determine child context
        const childContext = moduleContextMode === 'fork'
          ? forkContext(ctx, moduleName)
          : extendContext(ctx, moduleName);
        
        // Recursively run child module
        const childResult = await this.run(
          childModule,
          {
            input: childInput,
            validateInput: false, // Skip validation for @call args
            validateOutput
          },
          childContext
        );
        
        // Store result
        if (childResult.ok && 'data' in childResult) {
          callResults[call.match] = childResult.data;
        } else if ('error' in childResult) {
          callResults[call.match] = { error: childResult.error };
        }
      }
      
      // Substitute call results into prompt
      let modifiedModule = module;
      if (Object.keys(callResults).length > 0) {
        const modifiedPrompt = substituteCallResults(module.prompt, callResults);
        modifiedModule = {
          ...module,
          prompt: modifiedPrompt + '\n\n## Subagent Results Available\nThe @call results have been injected above. Use them in your response.\n'
        };
      }
      
      // Run the module
      const result = await runModule(modifiedModule, this.provider, {
        input,
        verbose: false,
        useV22: true
      });
      
      // Store result in context
      if (result.ok && 'data' in result) {
        ctx.results[moduleName] = result.data;
      }
      
      return result;
      
    } finally {
      this.running.delete(moduleName);
    }
  }
}

/**
 * Convenience function to run a module with subagent support
 */
export async function runWithSubagents(
  moduleName: string,
  provider: Provider,
  options: SubagentRunOptions & { cwd?: string } = {}
): Promise<ModuleResult> {
  const { cwd = process.cwd(), ...runOptions } = options;
  const orchestrator = new SubagentOrchestrator(provider, cwd);
  return orchestrator.run(moduleName, runOptions);
}
