'use client';
import { ButtonLink, SectionHeading, Strong } from '@nx/nx-dev-ui-common';
import { RustIcon, TypeScriptIcon } from '@nx/nx-dev-ui-icons';
import { ReactElement } from 'react';
import { NxHeroVideo } from './nx-hero-video';

export function Hero(): ReactElement {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 lg:px-8">
      <div className="z-20 mx-auto mb-32 grid max-w-6xl grid-cols-1 place-items-center pt-48 text-center">
        <div className="container">
          <SectionHeading as="h1" variant="display" data-cy="primary-heading">
            <span className="rounded-lg bg-gradient-to-tl from-slate-900 via-blue-800 to-cyan-500 bg-clip-text text-transparent dark:from-slate-100 dark:via-blue-800 dark:to-cyan-500">
              Smart
            </span>{' '}
            Repos
            <br className="sm:hidden" />
            <svg
              viewBox="0 0 2 2"
              fill="currentColor"
              className="mx-6 hidden size-2 sm:inline-flex xl:size-3"
            >
              <circle cx={1} cy={1} r={1} />
            </svg>
            <span className="rounded-lg bg-gradient-to-tl from-slate-900 via-pink-700 to-fuchsia-500 bg-clip-text text-transparent dark:from-slate-100 dark:via-pink-700 dark:to-fuchsia-500">
              Fast
            </span>{' '}
            Builds
          </SectionHeading>
          <SectionHeading
            as="p"
            variant="subtitle"
            className="mx-auto mt-6 max-w-3xl"
          >
            The only build platform that provides a powerful local development
            experience and an ultra-fast self-healing CI, so you can ship
            fast—without distraction.
          </SectionHeading>
          <div className="mt-10 flex flex-col items-center justify-center gap-6 sm:flex-row">
            <ButtonLink
              href="https://cloud.nx.app/get-started?utm_source=nx-dev&utm_medium=homepage_links&utm_campaign=try-nx-cloud"
              title="Get started with Nx & Nx Cloud"
              variant="primary"
              size="default"
            >
              Get started with Nx & Nx Cloud
            </ButtonLink>
            <ButtonLink
              href="/getting-started/intro?utm_medium=website&utm_campaign=homepage_links&utm_content=cta_hero_get_started"
              title="Get started"
              variant="secondary"
              size="default"
            >
              Documentation
            </ButtonLink>
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-sm italic">
            Built with
            <RustIcon aria-hidden="true" className="size-5 shrink-0" />
            <span className="sr-only">Rust</span> for speed &
            <TypeScriptIcon aria-hidden="true" className="size-4 shrink-0" />
            <span className="sr-only">TypeScript</span> for extensibility.
          </div>
        </div>
      </div>
      <NxHeroVideo />
    </div>
  );
}
