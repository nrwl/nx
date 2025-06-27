import { ReactElement, useState } from 'react';
import { SectionHeading, VideoModal } from '@nx/nx-dev/ui-common';
import { FeatureCard, type FeatureCardProps } from './feature-card';
import Link from 'next/link';

const features: FeatureCardProps[] = [
  {
    isAvailable: true,
    id: 'architectural-queries',
    title: 'Talk to your CI',
    subtitle: 'Ask questions about your CI runs in plain English.',
    description: (
      <>
        <p className="flex-auto">
          Ask questions like "Show me failed builds from last month" and get
          instant insights into performance metrics, cache patterns, and
          optimization opportunities.
        </p>
        <div className="mt-4">
          <Link
            href="/blog/nx-cloud-analyze-via-nx-mcp"
            title="Analyze Your Nx Cloud Runs With Your AI Assistant"
            className="text-sm/6 font-semibold"
          >
            Analyze Your Nx Cloud Runs With Your AI Assistant{' '}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    type: 'video',
    videoUrl: 'https://youtu.be/A68sjLnDwZQ',
    imageUrl: '/images/ai/ci-querying-thumb.avif',
  },
  {
    isAvailable: false,
    id: 'cross-repository-intelligence',
    title: 'Cross-Repository Intelligence',
    subtitle: 'AI that understands your entire organization.',
    description: (
      <p className="flex-auto">
        Nx Polygraph will extend AI context across multiple repositories,
        enabling system-wide refactoring and cross-repo analysis.
      </p>
    ),
    type: 'link',
    imageUrl: '/images/ai/cross-repository-intelligence-thumb.avif',
  },
  {
    isAvailable: false,
    id: 'cross-repository-agentic-refactorings',
    title: 'Cross-Repository Agentic Refactorings',
    subtitle: 'Modernize your entire organization with AI agents.',
    description: (
      <>
        <p className="flex-auto">
          Use autonomous agents to perform large-scale migrations and tech debt
          cleanup across all repositories. They understand cross-repo
          dependencies to execute complex, org-wide changes safely.
        </p>
      </>
    ),
    type: 'link',
    imageUrl: '/images/ai/cross-repository-agentic-refactorings-thumb.avif',
  },
];

export function WhileScalingYourOrganization(): ReactElement {
  const [openVideoUrl, setOpenVideoUrl] = useState<string | null>(null);

  return (
    <div className="relative">
      <div
        id="while-scaling-your-organization"
        className="mx-auto max-w-7xl scroll-mt-32 px-6 lg:px-8"
      >
        <div className="max-w-2xl">
          <div className="h-8 w-36 border-t-2 border-fuchsia-500" />
          <SectionHeading
            as="h2"
            variant="title"
            id="while-scaling-your-organization-title"
          >
            While Scaling Your Organization
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
    </div>
  );
}
