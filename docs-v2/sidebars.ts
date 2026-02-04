import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'doc',
      id: 'index',
      label: 'Introduction',
    },
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/installation',
        'getting-started/first-module',
        'getting-started/llm-config',
      ],
    },
    {
      type: 'category',
      label: 'Guide',
      collapsed: false,
      items: [
        'guide/module-format',
        'guide/arguments',
        'guide/subagent',
        'guide/context-philosophy',
        'guide/typescript-runtime',
        'guide/programmatic-api',
        'guide/testing',
      ],
    },
    {
      type: 'category',
      label: 'CLI Reference',
      collapsed: true,
      items: [
        'cli/overview',
        'cli/run',
        'cli/validate',
        'cli/migrate',
      ],
    },
    {
      type: 'category',
      label: 'Modules',
      collapsed: true,
      items: [
        'modules/index',
        'modules/code-reviewer',
        'modules/code-simplifier',
        'modules/task-prioritizer',
        'modules/api-designer',
        'modules/ui-spec-generator',
      ],
    },
    {
      type: 'category',
      label: 'Integration',
      collapsed: true,
      items: [
        'integration/http-api',
        'integration/mcp',
        'integration/ai-tools',
        'integration/agent-protocol',
      ],
    },
    {
      type: 'category',
      label: 'Specification',
      collapsed: false,
      items: [
        'specification/index',
        'specification/spec-v25',
        'specification/spec-v22',
        'specification/conformance',
        'specification/error-codes',
        {
          type: 'category',
          label: 'Advanced Features',
          collapsed: true,
          items: [
            'specification/composition',
            'specification/context-protocol',
          ],
        },
        {
          type: 'category',
          label: 'Ecosystem',
          collapsed: true,
          items: [
            'specification/registry-protocol',
            'specification/certification',
          ],
        },
        'specification/implementers-guide',
        {
          type: 'category',
          label: 'Governance',
          collapsed: true,
          items: [
            'specification/cmep-process',
            'specification/governance',
          ],
        },
      ],
    },
    {
      type: 'doc',
      id: 'spec',
      label: 'Specification (Legacy)',
    },
  ],
};

export default sidebars;
