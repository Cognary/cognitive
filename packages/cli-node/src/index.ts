/**
 * Cognitive Runtime - Main Entry Point
 * 
 * Exports all public APIs for programmatic use.
 */

// Types
export type {
  Provider,
  InvokeParams,
  InvokeResult,
  Message,
  CognitiveModule,
  ModuleResult,
  ModuleInput,
  ModuleConstraints,
  ToolsPolicy,
  OutputContract,
  FailureContract,
  CommandContext,
  CommandResult,
  // v2.2 Composition Types
  CompositionConfig,
  CompositionPattern,
  DependencyDeclaration,
  DataflowStep,
  DataflowMapping,
  RoutingRule,
  AggregationStrategy,
  IterationConfig,
} from './types.js';

// Providers
export {
  getProvider,
  listProviders,
  GeminiProvider,
  OpenAIProvider,
  AnthropicProvider,
  BaseProvider,
} from './providers/index.js';

// Modules
export {
  loadModule,
  findModule,
  listModules,
  getDefaultSearchPaths,
  runModule,
  // Subagent
  SubagentOrchestrator,
  runWithSubagents,
  parseCalls,
  createContext,
  // Composition
  CompositionOrchestrator,
  executeComposition,
  validateCompositionConfig,
  evaluateJsonPath,
  evaluateCondition,
  applyMapping,
  aggregateResults,
  versionMatches,
  resolveDependency,
  COMPOSITION_ERRORS,
  // Policy Enforcement
  checkToolPolicy,
  checkPolicy,
  checkToolAllowed,
  validateToolsAllowed,
  getDeniedActions,
  getDeniedTools,
  getAllowedTools,
  ToolCallInterceptor,
  createPolicyAwareExecutor,
  type PolicyAction,
  type PolicyCheckResult,
  type ToolCallRequest,
  type ToolCallResult,
  type ToolExecutor,
} from './modules/index.js';

// Server
export { serve as serveHttp, createServer } from './server/index.js';

// MCP
export { serve as serveMcp } from './mcp/index.js';

// Commands
export { run, list, pipe } from './commands/index.js';
