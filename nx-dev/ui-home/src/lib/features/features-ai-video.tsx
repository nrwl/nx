import { ButtonLink, SectionHeading } from '@nx/nx-dev-ui-common';
import Link from 'next/link';
import { cx } from '@nx/nx-dev-ui-primitives';
import { ComponentProps, ReactElement } from 'react';

export function FeaturesAiVideo(): ReactElement {
  return (
    <div className="py-16 lg:py-24">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <SectionHeading
          as="h3"
          variant="subtitle"
          id="from-code-to-deployment-in-record-time"
          className="scroll-mt-24 text-center text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl dark:text-white"
        >
          AI agents need{' '}
          <span className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
            the right
          </span>{' '}
          context
        </SectionHeading>
        <p className="mt-6 text-center text-lg text-slate-600 dark:text-slate-400">
          Repository structure determines whether AI amplifies your team or adds
          friction.
        </p>
        <div className="mt-12">
          <iframe
            src="https://www.youtube.com/embed/alIto5fqrfk?autoplay=0"
            title="Nx Developer Experience Video"
            width="100%"
            height="100%"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="size-full rounded-xl"
          />
        </div>

        <p className="mt-6 text-center text-lg text-slate-600 dark:text-slate-400">
          AI agents need complete codebase context. Nx monorepos provide it.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <ButtonLink
            href={'/blog/the-missing-multiplier-for-ai-agent-productivity'}
            title={'Learn more about Nx + AI'}
            variant="primary"
            size="default"
          >
            Learn more about Nx + AI
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
