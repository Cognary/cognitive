/**
 * Cognitive Modules MCP Server
 * 
 * Provides MCP (Model Context Protocol) interface for Claude Code, Cursor, etc.
 * 
 * Start with:
 *   cog mcp
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { loadModule, findModule, listModules, getDefaultSearchPaths } from '../modules/loader.js';
import { runModule } from '../modules/runner.js';
import { getProvider } from '../providers/index.js';
import type { CognitiveModule, ModuleResult } from '../types.js';

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: 'cognitive-modules',
    version: '1.2.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

const cwd = process.cwd();
const searchPaths = getDefaultSearchPaths(cwd);

// =============================================================================
// Tools
// =============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'cognitive_run',
        description: 'Run a Cognitive Module to get structured AI analysis results',
        inputSchema: {
          type: 'object',
          properties: {
            module: {
              type: 'string',
              description: 'Module name, e.g. "code-reviewer", "task-prioritizer"',
            },
            args: {
              type: 'string',
              description: 'Input arguments, e.g. code snippet or task list',
            },
            provider: {
              type: 'string',
              description: 'LLM provider (optional), e.g. "openai", "anthropic"',
            },
            model: {
              type: 'string',
              description: 'Model name (optional), e.g. "gpt-4o", "claude-3-5-sonnet"',
            },
          },
          required: ['module', 'args'],
        },
      },
      {
        name: 'cognitive_list',
        description: 'List all installed Cognitive Modules',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'cognitive_info',
        description: 'Get detailed information about a Cognitive Module',
        inputSchema: {
          type: 'object',
          properties: {
            module: {
              type: 'string',
              description: 'Module name',
            },
          },
          required: ['module'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'cognitive_run': {
        const { module: moduleName, args: inputArgs, provider: providerName, model } = args as {
          module: string;
          args: string;
          provider?: string;
          model?: string;
        };

        // Find module
        const moduleData = await findModule(moduleName, searchPaths);
        if (!moduleData) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ ok: false, error: `Module '${moduleName}' not found` }),
              },
            ],
          };
        }

        // Create provider
        const provider = getProvider(providerName, model);

        // Run module
        const result = await runModule(moduleData, provider, {
          input: { query: inputArgs, code: inputArgs },
          useV22: true,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'cognitive_list': {
        const modules = await listModules(searchPaths);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  modules: modules.map((m) => ({
                    name: m.name,
                    location: m.location,
                    format: m.format,
                    tier: m.tier,
                  })),
                  count: modules.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'cognitive_info': {
        const { module: moduleName } = args as { module: string };

        const moduleData = await findModule(moduleName, searchPaths);
        if (!moduleData) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ ok: false, error: `Module '${moduleName}' not found` }),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: true,
                  name: moduleData.name,
                  version: moduleData.version,
                  responsibility: moduleData.responsibility,
                  tier: moduleData.tier,
                  format: moduleData.format,
                  inputSchema: moduleData.inputSchema,
                  outputSchema: moduleData.outputSchema,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ ok: false, error: `Unknown tool: ${name}` }),
            },
          ],
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
    };
  }
});

// =============================================================================
// Resources
// =============================================================================

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const modules = await listModules(searchPaths);
  
  return {
    resources: [
      {
        uri: 'cognitive://modules',
        name: 'All Modules',
        description: 'List of all installed Cognitive Modules',
        mimeType: 'application/json',
      },
      ...modules.map((m) => ({
        uri: `cognitive://module/${m.name}`,
        name: m.name,
        description: m.responsibility || `Cognitive Module: ${m.name}`,
        mimeType: 'text/markdown',
      })),
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === 'cognitive://modules') {
    const modules = await listModules(searchPaths);
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(modules.map((m) => m.name), null, 2),
        },
      ],
    };
  }

  const match = uri.match(/^cognitive:\/\/module\/(.+)$/);
  if (match) {
    const moduleName = match[1];
    const moduleData = await findModule(moduleName, searchPaths);

    if (!moduleData) {
      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: `Module '${moduleName}' not found`,
          },
        ],
      };
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text: moduleData.prompt,
        },
      ],
    };
  }

  return {
    contents: [
      {
        uri,
        mimeType: 'text/plain',
        text: `Unknown resource: ${uri}`,
      },
    ],
  };
});

// =============================================================================
// Prompts
// =============================================================================

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'code_review',
        description: 'Generate a code review prompt',
        arguments: [
          {
            name: 'code',
            description: 'The code to review',
            required: true,
          },
        ],
      },
      {
        name: 'task_prioritize',
        description: 'Generate a task prioritization prompt',
        arguments: [
          {
            name: 'tasks',
            description: 'The tasks to prioritize',
            required: true,
          },
        ],
      },
    ],
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'code_review': {
      const code = args?.code ?? '';
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please use the cognitive_run tool to review the following code:\n\n\`\`\`\n${code}\n\`\`\`\n\nCall: cognitive_run("code-reviewer", "${code.slice(0, 100)}...")`,
            },
          },
        ],
      };
    }

    case 'task_prioritize': {
      const tasks = args?.tasks ?? '';
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please use the cognitive_run tool to prioritize the following tasks:\n\n${tasks}\n\nCall: cognitive_run("task-prioritizer", "${tasks}")`,
            },
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

// =============================================================================
// Server Start
// =============================================================================

export async function serve(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Cognitive Modules MCP Server started');
}

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  serve().catch(console.error);
}
