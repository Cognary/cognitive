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
        message: 'OpenAI / Anthropic / Gemini / MiniMax / DeepSeek / Qwen - one module, run anywhere.',
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
        id: 'homepage.entries.gettingStarted.title',
        message: 'Getting Started',
      }),
      description: translate({
        id: 'homepage.entries.gettingStarted.description',
        message: 'Install, run the 5-minute path, and learn the core workflow.',
      }),
      to: '/docs/getting-started/installation',
      Icon: ArrowRight,
    },
    {
      title: translate({
        id: 'homepage.entries.useCases.title',
        message: 'Killer Use Cases',
      }),
      description: translate({
        id: 'homepage.entries.useCases.description',
        message: 'Where contracts + risk routing make AI workflows shippable.',
      }),
      to: '/docs/getting-started/use-cases',
      Icon: ShieldCheck,
    },
    {
      title: translate({
        id: 'homepage.entries.providers.title',
        message: 'Providers',
      }),
      description: translate({
        id: 'homepage.entries.providers.description',
        message: 'Capability differences, structured-output downgrade, and stability rules.',
      }),
      to: '/docs/integration/providers',
      Icon: LinkIcon,
    },
    {
      title: translate({
        id: 'homepage.entries.conformance.title',
        message: 'Conformance',
      }),
      description: translate({
        id: 'homepage.entries.conformance.description',
        message: 'Test vectors and publish-grade contract checks.',
      }),
      to: '/docs/conformance',
      Icon: DatabaseScript,
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
            A publish-grade contract for AI tasks: envelope, schemas, policy, and auditability.
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
            5-Minute Path
          </Translate>
        </h2>
        <div className={styles.codeBlock}>
          <pre>
            <code>{`# Zero-install run
export OPENAI_API_KEY=sk-xxx
cat <<'EOF' | npx cogn@2.2.13 core run --stdin --args "hello" --pretty
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

function HomepageKillerUseCase() {
  return (
    <section className={styles.killerUseCase}>
      <div className={styles.killerUseCaseContainer}>
        <h2 className={styles.killerUseCaseTitle}>
          <Translate
            id="homepage.killer.title"
            description="Homepage killer use case section title">
            Killer Use Case: PR Review Gate (CI)
          </Translate>
        </h2>
        <p className={styles.killerUseCaseSubtitle}>
          <Translate
            id="homepage.killer.subtitle"
            description="Homepage killer use case section subtitle">
            Run a module on the PR diff, route by meta.risk, and block merges on high risk.
          </Translate>
        </p>
        <div className={styles.killerUseCaseBullets}>
          <div className={styles.killerUseCaseBullet}>
            <strong>Contract</strong>: always v2.2 envelope (ok/meta/data|error)
          </div>
          <div className={styles.killerUseCaseBullet}>
            <strong>Routing</strong>: low/medium/high risk as a first-class field
          </div>
          <div className={styles.killerUseCaseBullet}>
            <strong>Stability</strong>: provider differences downgrade safely, with reasons in meta.policy
          </div>
        </div>
        <div className={styles.killerUseCaseCtas}>
          <Link className={styles.killerUseCasePrimary} to="/docs/getting-started/use-cases">
            <Translate id="homepage.killer.cta" description="Homepage killer use case CTA">
              View use cases →
            </Translate>
          </Link>
          <Link className={styles.killerUseCaseSecondary} to="/docs/integration/providers">
            <Translate id="homepage.killer.providersCta" description="Homepage killer use case providers CTA">
              Provider stability rules →
            </Translate>
          </Link>
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
        <HomepageQuickStart />
        <HomepageKillerUseCase />
        <HomepageFeatures />
        <HomepageEntryLinks />
      </main>
    </Layout>
  );
}
