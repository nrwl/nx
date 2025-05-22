import type { Metadata } from 'next';
import { DefaultLayout } from '@nx/nx-dev/ui-common';
import { Hero } from '@nx/nx-dev/ui-ai-landing-page';
import { ProblemStatement } from '@nx/nx-dev/ui-ai-landing-page';
import { Features } from '@nx/nx-dev/ui-ai-landing-page';
import { CallToAction } from '@nx/nx-dev/ui-ai-landing-page';
import { TechnicalImplementation } from '@nx/nx-dev/ui-ai-landing-page';

export const metadata: Metadata = {
  title: 'Nx - Make AI work in large codebases',
  description:
    'Empower your AI assistants with workspace intelligence to understand your codebase structure, project dependencies, and build processes at a glance.',
  alternates: {
    canonical: 'https://nx.dev/ai',
  },
  openGraph: {
    title: 'Nx - Make AI work in large codebases',
    description:
      'Empower your AI assistants with workspace intelligence to understand your codebase structure, project dependencies, and build processes at a glance.',
    url: 'https://nx.dev/ai',
    siteName: 'Nx',
    images: [
      {
        url: 'https://nx.dev/images/nx-ai-landing-og.png',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  keywords: [
    'nx',
    'ai',
    'workspace',
    'architecture',
    'codebase',
    'llm',
    'AI workspace development',
    'LLM code assistant',
    'Nx AI integration',
    'multi-project AI tools',
    'enterprise AI development',
    'intelligent code generation',
    'MCP server',
    'workspace AI tools',
    'monorepo AI',
    'architectural intelligence',
    'code assistant',
    'workspace intelligence',
  ],
};

export default function AiLandingPage() {
  return (
    <DefaultLayout>
      <Hero />

      <div className="mt-32 lg:mt-56" id="problem-statement">
        <ProblemStatement />
      </div>

      <div className="mt-32 lg:mt-56" id="features">
        <Features />
      </div>

      <div className="mt-32 lg:mt-56" id="how-it-works">
        <TechnicalImplementation />
      </div>

      <div className="mt-32 lg:mt-56">
        <CallToAction />
      </div>
    </DefaultLayout>
  );
}
