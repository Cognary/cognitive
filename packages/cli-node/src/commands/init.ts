/**
 * cog init - Initialize a new Cognitive project
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { CommandContext, CommandResult } from '../types.js';

const EXAMPLE_MODULE_MD = `---
name: my-module
version: 1.0.0
responsibility: Describe what this module does
excludes:
  - Do not do X
  - Do not do Y
---

Analyze the following input and provide a structured response:

$ARGUMENTS

Return a JSON object with your analysis.
`;

const EXAMPLE_SCHEMA_JSON = `{
  "type": "object",
  "properties": {
    "result": {
      "type": "string",
      "description": "The main result of the analysis"
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Confidence score"
    },
    "rationale": {
      "type": "string",
      "description": "Explanation of the reasoning"
    }
  },
  "required": ["result", "confidence", "rationale"]
}
`;

export async function init(ctx: CommandContext, moduleName?: string): Promise<CommandResult> {
  const cognitiveDir = path.join(ctx.cwd, 'cognitive', 'modules');
  
  try {
    // Create directory structure
    await fs.mkdir(cognitiveDir, { recursive: true });
    
    // If module name provided, create a new module
    if (moduleName) {
      const moduleDir = path.join(cognitiveDir, moduleName);
      await fs.mkdir(moduleDir, { recursive: true });
      
      await fs.writeFile(
        path.join(moduleDir, 'MODULE.md'),
        EXAMPLE_MODULE_MD.replace('my-module', moduleName)
      );
      
      await fs.writeFile(
        path.join(moduleDir, 'schema.json'),
        EXAMPLE_SCHEMA_JSON
      );
      
      return {
        success: true,
        data: {
          message: `Created module: ${moduleName}`,
          location: moduleDir,
          files: ['MODULE.md', 'schema.json'],
        },
      };
    }
    
    // Just initialize the directory
    return {
      success: true,
      data: {
        message: 'Cognitive project initialized',
        location: cognitiveDir,
        hint: 'Run "cog init <module-name>" to create a new module',
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
