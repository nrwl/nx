import { ReactElement, useState } from 'react';
import { SectionHeading, VideoModal } from '@nx/nx-dev/ui-common';
import Link from 'next/link';
import { FeatureCard, type FeatureCardProps } from './feature-card';

const features: FeatureCardProps[] = [
  {
    isAvailable: true,
    id: 'deep-project-understanding',
    title: 'Deep Project Understanding Through MCP',
    subtitle: '"Context is worth 80 IQ points" - Alan Kay',
    description: (
      <>
        <p className="flex-auto">
          Nx connects your AI assistant to its comprehensive workspace knowledge
          through the Model Context Protocol (MCP), delivering complete insights
          into project graphs, dependencies, and code ownership.
        </p>
        <div className="mt-4">
          <Link
            href="/blog/nx-mcp-vscode-copilot"
            title="How to setup Nx MCP to your LLM"
            className="text-sm/6 font-semibold"
          >
            How to setup Nx MCP to your LLM <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    type: 'video',
    videoUrl: 'https://youtu.be/RNilYmJJzdk',
    imageUrl: '/images/ai/nx-copilot-mcp-yt-thumb.avif',
  },
  {
    isAvailable: true,
    id: 'terminal-awareness-in-real-time',
    title: 'Terminal Awareness in Real-Time',
    subtitle: 'Your AI sees what you see, when you see it.',
    description: (
      <>
        <p className="flex-auto">
          Your AI assistant can access the terminal output on-demand through
          MCP. When you ask about failing builds or broken tests, it retrieves
          the relevant error messages and combines them with full codebase
          context.
        </p>
        <div className="mt-4">
          <Link
            href="/blog/nx-terminal-integration-ai"
            title="How to set AI terminal integration"
            className="text-sm/6 font-semibold"
          >
            How to set terminal AI integration with Nx{' '}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    type: 'video',
    videoUrl: 'https://youtu.be/Cbc9_W5J6DA',
    imageUrl: '/images/ai/terminal-llm-comm-thumb.avif',
  },
  {
    isAvailable: true,
    id: 'predictable-workspace-aware-code-generation',
    title: 'Predictable, Workspace-Aware Code Generation',
    subtitle:
      'Combine AI intelligence with consistent generators that follow team standards',
    description: (
      <>
        <p className="flex-auto">
          Your AI assistant can trigger code generation using predictable Nx
          generators, then take it from there to intelligently integrate the
          result into your existing workspace architecture.
        </p>
        <div className="mt-4">
          <Link
            href="/blog/nx-generators-ai-integration"
            title="How to generate code that works with AI"
            className="text-sm/6 font-semibold"
          >
            How to generate code that works with AI{' '}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    type: 'video',
    videoUrl: 'https://youtu.be/PXNjedYhZDs',
    imageUrl: '/images/ai/video-code-gen-and-ai-thumb.avif',
  },
];

export function WhileCoding(): ReactElement {
  const [openVideoUrl, setOpenVideoUrl] = useState<string | null>(null);

  return (
    <div
      id="while-coding"
      className="mx-auto max-w-7xl scroll-mt-32 px-6 lg:px-8"
    >
      <div className="max-w-2xl">
        <div className="h-8 w-36 border-t-2 border-blue-500 dark:border-sky-500" />
        <SectionHeading as="h2" variant="title" id="while-coding-title">
          While Coding
        </SectionHeading>
      </div>
      <div className="mt-16 sm:mt-20 lg:mt-24">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) =>
            feature.type === 'video' ? (
              <FeatureCard
                key={feature.id}
                isAvailable={feature.isAvailable}
                id={feature.id}
                title={feature.title}
                subtitle={feature.subtitle}
                description={feature.description}
                type={feature.type}
                imageUrl={feature.imageUrl}
                videoUrl={feature.videoUrl}
                onPlayClick={setOpenVideoUrl}
              />
            ) : (
              <FeatureCard
                key={feature.id}
                isAvailable={feature.isAvailable}
                id={feature.id}
                title={feature.title}
                subtitle={feature.subtitle}
                description={feature.description}
                type={feature.type}
                imageUrl={feature.imageUrl}
              />
            )
          )}
        </dl>
      </div>
      <VideoModal
        isOpen={openVideoUrl !== null}
        onClose={() => setOpenVideoUrl(null)}
        videoUrl={openVideoUrl || ''}
      />
    </div>
  );
}
