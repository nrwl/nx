import type { ReactElement } from 'react';
import { ButtonLink, SectionHeading } from '@nx/nx-dev-ui-common';
import {
  CodeBracketIcon,
  ServerStackIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { NxPowerAi } from './nx-power-ai';

export function AiHero(): ReactElement {
  return (
    <section>
      <div className="mx-auto flex max-w-7xl">
        <div className="max-w-4xl px-6 pb-24 pt-12 lg:mx-0 lg:shrink-0 lg:px-8">
          <SectionHeading
            id="get-speed-and-scale"
            as="h1"
            variant="display"
            className="text-pretty tracking-tight"
          >
            From editor to CI, <br /> Nx makes your AI <br />
            <span className="rounded-lg bg-gradient-to-r from-pink-500 to-fuchsia-500 bg-clip-text text-transparent">
              a lot more powerful.
            </span>
          </SectionHeading>
          <div className="mt-6">
            <ButtonLink
              href="/getting-started/ai-integration"
              title="Nx AI Integration"
              variant="primary"
              size="small"
            >
              Integrate Nx with your Coding Assistant
            </ButtonLink>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="#while-coding"
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              aria-label="Jump to While Coding section"
            >
              <CodeBracketIcon aria-hidden="true" className="size-4 shrink-0" />
              <span>Coding</span>
            </a>
            <a
              href="#while-running-ci"
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              aria-label="Jump to While Running CI section"
            >
              <ServerStackIcon aria-hidden="true" className="size-4 shrink-0" />
              <span>Running CI</span>
            </a>
            <a
              href="#while-scaling-your-organization"
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              aria-label="Jump to Scaling Your Organization section"
            >
              <UserGroupIcon aria-hidden="true" className="size-4 shrink-0" />
              <span>Scaling Your Organization</span>
            </a>
          </div>
        </div>
        <div className="hidden w-auto grow grid-cols-1 place-items-center lg:grid">
          <NxPowerAi className="-mt-8" />
        </div>
      </div>
    </section>
  );
}
