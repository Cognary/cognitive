import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Cognitive Modules',
  tagline: 'Verifiable Structured AI Task Specifications',
  favicon: 'img/favicon.ico',

  url: 'https://ziel-io.github.io',
  baseUrl: '/cognitive-modules/',

  organizationName: 'ziel-io',
  projectName: 'cognitive-modules',

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh-Hans'],
    localeConfigs: {
      en: {
        label: 'English',
        htmlLang: 'en',
      },
      'zh-Hans': {
        label: '中文',
        htmlLang: 'zh-Hans',
      },
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/ziel-io/cognitive-modules/tree/main/docs-v2/',
          routeBasePath: 'docs',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        language: ['en', 'zh'],
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
        docsRouteBasePath: '/docs',
        indexBlog: false,
      },
    ],
  ],

  themeConfig: {
    image: 'img/social-card.png',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'Cognitive Modules',
      logo: {
        alt: 'Cognitive Modules Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/docs/conformance',
          label: 'Conformance',
          position: 'left',
        },
        {
          to: '/docs/registry',
          label: 'Registry',
          position: 'left',
        },
        {
          to: '/docs/release-notes',
          label: 'Release Notes',
          position: 'left',
        },
        {
          href: 'https://github.com/ziel-io/cognitive-modules',
          label: 'GitHub',
          position: 'right',
          className: 'navbar-github-link',
        },
        {
          type: 'localeDropdown',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/getting-started/installation',
            },
            {
              label: 'Module Format',
              to: '/docs/guide/module-format',
            },
            {
              label: 'CLI Reference',
              to: '/docs/cli/overview',
            },
            {
              label: 'Conformance',
              to: '/docs/conformance',
            },
            {
              label: 'Registry',
              to: '/docs/registry',
            },
          ],
        },
        {
          title: 'Modules',
          items: [
            {
              label: 'code-reviewer',
              to: '/docs/modules/code-reviewer',
            },
            {
              label: 'code-simplifier',
              to: '/docs/modules/code-simplifier',
            },
            {
              label: 'api-designer',
              to: '/docs/modules/api-designer',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Release Notes',
              to: '/docs/release-notes',
            },
            {
              label: 'Governance',
              to: '/docs/community/governance',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/ziel-io/cognitive-modules',
            },
            {
              label: 'npm',
              href: 'https://www.npmjs.com/package/cogn',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} ziel-io. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.dracula,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'yaml', 'python', 'typescript'],
    },
    algolia: undefined,
  } satisfies Preset.ThemeConfig,
};

export default config;
