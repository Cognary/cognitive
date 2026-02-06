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
      label: 'Conformance',
      collapsed: true,
      items: [
        'conformance/index',
        'conformance/levels',
        'conformance/testing',
      ],
    },
    {
      type: 'category',
      label: 'Registry',
      collapsed: true,
      items: [
        'registry/index',
        'registry/protocol',
        'registry/schema',
      ],
    },
    {
      type: 'category',
      label: 'Release Notes',
      collapsed: true,
      items: [
        'release-notes/index',
        'release-notes/v2.2.5',
      ],
    },
    {
      type: 'category',
      label: 'Community',
      collapsed: true,
      items: [
        'community/contributing',
        'community/governance',
        'community/cmep-process',
        'community/spec-lifecycle',
      ],
    },
    {
      type: 'category',
      label: 'Specification',
      collapsed: true,
      items: [
        'spec',
        'spec/cep/overview',
        'spec/cep/module',
        'spec/cep/envelope',
        'spec/cep/events',
        'spec/cep/conformance',
        'spec/cep/registry',
      ],
    },
  ],
};

export default sidebars;
