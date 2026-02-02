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
} from './modules/index.js';

// Server
export { serve as serveHttp, createServer } from './server/index.js';

// MCP
export { serve as serveMcp } from './mcp/index.js';

// Commands
export { run, list, pipe } from './commands/index.js';
