import React from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
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
} from 'iconoir-react';

import styles from './index.module.css';

const ICON_PROPS = { strokeWidth: 1.25, width: 24, height: 24 };

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={styles.heroBanner}>
      <div className={styles.heroContent}>
        <h1 className={styles.heroTitle}>{siteConfig.title}</h1>
        <p className={styles.heroSubtitle}>{siteConfig.tagline}</p>
        <div className={styles.heroButtons}>
          <Link
            className={styles.heroPrimaryButton}
            to="/docs/getting-started/installation">
            Get Started
            <ArrowRight {...ICON_PROPS} width={18} height={18} />
          </Link>
          <Link
            className={styles.heroSecondaryButton}
            to="https://github.com/ziel-io/cognitive-modules">
            <Github {...ICON_PROPS} width={18} height={18} />
            GitHub
          </Link>
        </div>
      </div>
    </header>
  );
}

const features = [
  {
    title: 'Strong Type Contracts',
    description: 'JSON Schema bidirectional validation for inputs and outputs, ensuring reliable structured output.',
    Icon: CodeBrackets,
  },
  {
    title: 'Control/Data Separation',
    description: 'Meta control plane for routing decisions, data plane for business logic and auditing.',
    Icon: GitBranch,
  },
  {
    title: 'Module Tiers',
    description: 'exec / decision / exploration - three tiers with different constraints for different scenarios.',
    Icon: FilterList,
  },
  {
    title: 'Explainable Output',
    description: 'Mandatory confidence + rationale output, every call has confidence score and reasoning.',
    Icon: Eye,
  },
  {
    title: 'Multi-LLM Support',
    description: 'OpenAI / Anthropic / MiniMax / Ollama - one module, run anywhere.',
    Icon: Cpu,
  },
  {
    title: 'MCP Integration',
    description: 'Native support for Claude Desktop, Cursor and other AI tools, seamless integration.',
    Icon: LinkIcon,
  },
];

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
  return (
    <section className={styles.features}>
      <div className={styles.featuresContainer}>
        <h2 className={styles.featuresTitle}>Core Features</h2>
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
        <h2>Quick Start</h2>
        <div className={styles.codeBlock}>
          <pre>
            <code>{`# Zero-install run
npx cogn run code-reviewer --args "your code" --pretty

# Or install globally
npm install -g cogn
cog run code-reviewer --args "your code" --pretty`}</code>
          </pre>
        </div>
        <Link className={styles.quickStartLink} to="/docs/getting-started/installation">
          View full installation guide →
        </Link>
      </div>
    </section>
  );
}

export default function Home(): JSX.Element {
  return (
    <Layout
      title="Verifiable Structured AI Task Specifications"
      description="Cognitive Modules - Verifiable Structured AI Task Specifications">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <HomepageQuickStart />
      </main>
    </Layout>
  );
}
