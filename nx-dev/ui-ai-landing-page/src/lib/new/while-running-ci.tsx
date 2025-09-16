import { ReactElement, useState } from 'react';
import { SectionHeading, VideoModal } from '@nx/nx-dev-ui-common';
import Link from 'next/link';
import { FeatureCard, type FeatureCardProps } from './feature-card';

const features: FeatureCardProps[] = [
  {
    isAvailable: true,
    id: 'reliable-tests',
    title: 'Reliable Tests',
    subtitle: 'Turn flaky tests from time-wasters into non-issues.',
    description: (
      <>
        <p className="flex-auto">
          Nx automatically identifies and fixes flaky tests using AI that
          analyzes failures with workspace context and generates actual code
          fixes.
        </p>
        <div className="mt-4">
          <Link
            href={
              process.env.NEXT_PUBLIC_ASTRO_URL
                ? '/docs/features/ci-features/flaky-tasks'
                : '/ci/features/flaky-tasks'
            }
            title="How to identify and rerun flaky tasks"
            className="text-sm/6 font-semibold"
          >
            How to identify and rerun flaky tasks{' '}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    type: 'link',
    imageUrl: '/images/ai/nx-flaky-tasks-detection-thumb.avif',
  },
  {
    isAvailable: true,
    id: 'self-healing-ci',
    title: 'Self-Healing CI',
    subtitle: 'Stop babysitting PRs. AI fixes your CI failures automatically.',
    description: (
      <>
        <p className="flex-auto">
          AI agents detect, analyze, and propose fixes for CI failures using
          your workspace context. Stay focused on features while AI handles the
          debugging.
        </p>
        <div className="mt-4">
          <Link
            href="/blog/nx-self-healing-ci"
            title="Stop babysitting PRs with Self-Healing CI"
            className="text-sm/6 font-semibold"
          >
            Stop babysitting PRs with Self-Healing CI{' '}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    type: 'video',
    videoUrl: 'https://youtu.be/JW5Ki3PkRWA',
    imageUrl: '/images/ai/self-healing-ci-thumb.avif',
  },
  {
    isAvailable: true,
    id: 'autonomous-ci-optimization',
    title: 'Autonomous CI Optimization',
    subtitle: 'Let AI manage your CI resources for optimal performance.',
    description: (
      <>
        <p className="flex-auto">
          AI-driven resource allocation that learns from your CI patterns to
          automatically scale agents and optimize build times.
        </p>
        <div className="mt-4">
          <Link
            href={
              process.env.NEXT_PUBLIC_ASTRO_URL
                ? '/docs/features/ci-features/dynamic-agents'
                : '/ci/features/dynamic-agents'
            }
            title="How to setup dynamic agents"
            className="text-sm/6 font-semibold"
          >
            How to setup Autonomous CI Optimization{' '}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    type: 'link',
    imageUrl: '/images/ai/autonomous-ci-optimization-thumb.avif',
  },
];

export function WhileRunningCi(): ReactElement {
  const [openVideoUrl, setOpenVideoUrl] = useState<string | null>(null);

  return (
    <div className="relative bg-slate-50 py-32 dark:bg-slate-800">
      <div
        id="while-running-ci"
        className="mx-auto max-w-7xl scroll-mt-32 px-6 lg:px-8"
      >
        <div className="max-w-2xl">
          <div className="h-8 w-36 border-t-2 border-emerald-500" />
          <SectionHeading as="h2" variant="title" id="while-running-ci-title">
            While Running CI
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
