import React from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Translate, {translate} from '@docusaurus/Translate';
import Layout from '@theme/Layout';
import {
  CodeBrackets,
  GitBranch,
  FilterList,
  Eye,
  Cpu,
  Link as LinkIcon,
  ArrowRight,
  Github,
  ShieldCheck,
  DatabaseScript,
  Notes,
  Community,
} from 'iconoir-react';

import styles from './index.module.css';

const ICON_PROPS = { strokeWidth: 1.25, width: 24, height: 24 };
type Feature = {
  title: string;
  description: string;
  Icon: React.ComponentType<any>;
};
type EntryLink = {
  title: string;
  description: string;
  to: string;
  Icon: React.ComponentType<any>;
};

function getFeatures(): Feature[] {
  return [
    {
      title: translate({
        id: 'homepage.features.strongContracts.title',
        message: 'Strong Type Contracts',
      }),
      description: translate({
        id: 'homepage.features.strongContracts.description',
        message: 'JSON Schema bidirectional validation for inputs and outputs, ensuring reliable structured output.',
      }),
      Icon: CodeBrackets,
    },
    {
      title: translate({
        id: 'homepage.features.controlData.title',
        message: 'Control/Data Separation',
      }),
      description: translate({
        id: 'homepage.features.controlData.description',
        message: 'Meta control plane for routing decisions, data plane for business logic and auditing.',
      }),
      Icon: GitBranch,
    },
    {
      title: translate({
        id: 'homepage.features.moduleTiers.title',
        message: 'Module Tiers',
      }),
      description: translate({
        id: 'homepage.features.moduleTiers.description',
        message: 'exec / decision / exploration - three tiers with different constraints for different scenarios.',
      }),
      Icon: FilterList,
    },
    {
      title: translate({
        id: 'homepage.features.explainable.title',
        message: 'Explainable Output',
      }),
      description: translate({
        id: 'homepage.features.explainable.description',
        message: 'Mandatory confidence + rationale output, every call has confidence score and reasoning.',
      }),
      Icon: Eye,
    },
    {
      title: translate({
        id: 'homepage.features.multiLlm.title',
        message: 'Multi-LLM Support',
      }),
      description: translate({
        id: 'homepage.features.multiLlm.description',
        message: 'OpenAI / Anthropic / MiniMax / Ollama - one module, run anywhere.',
      }),
      Icon: Cpu,
    },
    {
      title: translate({
        id: 'homepage.features.mcp.title',
        message: 'MCP Integration',
      }),
      description: translate({
        id: 'homepage.features.mcp.description',
        message: 'Native support for Claude Desktop, Cursor and other AI tools, seamless integration.',
      }),
      Icon: LinkIcon,
    },
  ];
}

function getEntryLinks(): EntryLink[] {
  return [
    {
      title: translate({
        id: 'homepage.entries.conformance.title',
        message: 'Conformance',
      }),
      description: translate({
        id: 'homepage.entries.conformance.description',
        message: 'Conformance levels, requirements, and testing vectors.',
      }),
      to: '/docs/conformance',
      Icon: ShieldCheck,
    },
    {
      title: translate({
        id: 'homepage.entries.registry.title',
        message: 'Registry',
      }),
      description: translate({
        id: 'homepage.entries.registry.description',
        message: 'Discovery, distribution protocol, and schema validation.',
      }),
      to: '/docs/registry',
      Icon: DatabaseScript,
    },
    {
      title: translate({
        id: 'homepage.entries.releaseNotes.title',
        message: 'Release Notes',
      }),
      description: translate({
        id: 'homepage.entries.releaseNotes.description',
        message: 'Version updates and compatibility clarifications for 2.2.x.',
      }),
      to: '/docs/release-notes',
      Icon: Notes,
    },
    {
      title: translate({
        id: 'homepage.entries.community.title',
        message: 'Community',
      }),
      description: translate({
        id: 'homepage.entries.community.description',
        message: 'Governance, process, and contribution entry points.',
      }),
      to: '/docs/community/contributing',
      Icon: Community,
    },
  ];
}

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={styles.heroBanner}>
      <div className={styles.heroContent}>
        <h1 className={styles.heroTitle}>{siteConfig.title}</h1>
        <p className={styles.heroSubtitle}>
          <Translate
            id="homepage.hero.subtitle"
            description="Homepage hero subtitle">
            Verifiable Structured AI Task Specifications
          </Translate>
        </p>
        <div className={styles.heroButtons}>
          <Link
            className={styles.heroPrimaryButton}
            to="/docs/getting-started/installation">
            <Translate
              id="homepage.hero.primaryCta"
              description="Homepage primary CTA text">
              Get Started
            </Translate>
            <ArrowRight {...ICON_PROPS} width={18} height={18} />
          </Link>
          <Link
            className={styles.heroSecondaryButton}
            to="/docs/spec">
            <Translate
              id="homepage.hero.specCta"
              description="Homepage specification CTA text">
              Specification
            </Translate>
          </Link>
          <Link
            className={styles.heroSecondaryButton}
            to="https://github.com/Cognary/cognitive">
            <Github {...ICON_PROPS} width={18} height={18} />
            <Translate
              id="homepage.hero.secondaryCta"
              description="Homepage secondary CTA text">
              GitHub
            </Translate>
          </Link>
        </div>
      </div>
    </header>
  );
}

function FeatureCard({title, description, Icon}: {title: string; description: string; Icon: React.ComponentType<any>}) {
  return (
    <div className={styles.featureCard}>
      <div className={styles.featureIcon}>
        <Icon {...ICON_PROPS} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function HomepageFeatures() {
  const features = getFeatures();

  return (
    <section className={styles.features}>
      <div className={styles.featuresContainer}>
        <h2 className={styles.featuresTitle}>
          <Translate
            id="homepage.features.sectionTitle"
            description="Homepage features section title">
            Core Features
          </Translate>
        </h2>
        <div className={styles.featuresGrid}>
          {features.map(({Icon, ...props}, idx) => (
            <FeatureCard key={idx} Icon={Icon} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

function HomepageQuickStart() {
  return (
    <section className={styles.quickStart}>
      <div className={styles.quickStartContainer}>
        <h2>
          <Translate
            id="homepage.quickStart.title"
            description="Homepage quick start section title">
            Quick Start
          </Translate>
        </h2>
        <div className={styles.codeBlock}>
          <pre>
            <code>{`# Zero-install run
export OPENAI_API_KEY=sk-xxx
cat <<'EOF' | npx cogn@2.2.11 core run --stdin --args "hello" --pretty
Return a valid v2.2 envelope (meta + data). Put your answer in data.result.
EOF

# Provider/model flags must come after the command:
# ... core run --stdin --provider minimax --model MiniMax-M2.1 ...`}</code>
          </pre>
        </div>
        <Link className={styles.quickStartLink} to="/docs/getting-started/installation">
          <Translate
            id="homepage.quickStart.link"
            description="Homepage quick start link text">
            View full installation guide →
          </Translate>
        </Link>
      </div>
    </section>
  );
}

function HomepageEntryLinks() {
  const entryLinks = getEntryLinks();

  return (
    <section className={styles.entrySection}>
      <div className={styles.entryContainer}>
        <h2 className={styles.entryTitle}>
          <Translate
            id="homepage.entries.sectionTitle"
            description="Homepage entry links section title">
            Explore by Topic
          </Translate>
        </h2>
        <div className={styles.entryGrid}>
          {entryLinks.map(({title, description, to, Icon}) => (
            <Link key={to} className={styles.entryCard} to={to}>
              <div className={styles.entryIcon}>
                <Icon {...ICON_PROPS} />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): JSX.Element {
  return (
    <Layout
      title={translate({
        id: 'homepage.meta.title',
        message: 'Verifiable Structured AI Task Specifications',
      })}
      description={translate({
        id: 'homepage.meta.description',
        message: 'Cognitive Modules - Verifiable Structured AI Task Specifications',
      })}>
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <HomepageEntryLinks />
        <HomepageQuickStart />
      </main>
    </Layout>
  );
}
