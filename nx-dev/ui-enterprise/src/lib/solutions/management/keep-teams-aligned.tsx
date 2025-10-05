import {
  ArrowsRightLeftIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { ReactElement } from 'react';
import { SectionHeading } from '@nx/nx-dev-ui-common';
import Link from 'next/link';

const features = [
  {
    name: 'Enable developer mobility',
    description: (
      <p className="flex-auto">
        Standardized practices and shared architectural context make it easy for
        engineers to onboard quickly and increase dev mobility across projects
        and teams.
      </p>
    ),
    icon: ArrowsRightLeftIcon,
  },
  {
    name: 'Define and enforce standards',
    description: (
      <>
        <p className="flex-auto">
          Establish best practices once and propagate them across teams with{' '}
          <Link
            href="/ci/recipes/enterprise/conformance/publish-conformance-rules-to-nx-cloud#publish-conformance-rules-to-nx-cloud"
            title="Nx Conformance rules"
            prefetch={false}
            className="underline"
          >
            Conformance rules
          </Link>
          .
        </p>
        <div className="mt-4">
          <Link
            href="/ci/recipes/enterprise/conformance/publish-conformance-rules-to-nx-cloud#publish-conformance-rules-to-nx-cloud"
            title="Learn more about Nx Conformance rules"
            className="text-sm/6 font-semibold"
          >
            Learn more about Nx Conformance rules{' '}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    icon: ShieldCheckIcon,
  },
  {
    name: 'Align knowledge across teams with smarter AI',
    description: (
      <>
        <p className="flex-auto">
          Use Nx’s MCP server to ensure every engineer and LLM operates from the
          same source of truth.
        </p>
        <div className="mt-4">
          <Link
            href={
              process.env.NEXT_PUBLIC_ASTRO_URL
                ? '/docs/features/enhance-ai'
                : '/features/enhance-AI'
            }
            title="Learn about Enhancing your LLM"
            className="text-sm/6 font-semibold"
          >
            Learn about Enhancing your LLM <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    icon: SparklesIcon,
  },
];

export function KeepTeamsAligned(): ReactElement {
  return (
    <div
      id="keep-teams-aligned"
      className="mx-auto max-w-7xl scroll-mt-32 px-6 lg:px-8"
    >
      <div className="mx-auto max-w-2xl lg:mx-0">
        <div className="h-8 w-36 border-t-2 border-blue-500 dark:border-sky-500" />
        <SectionHeading as="h2" variant="title" id="keep-teams-aligned-title">
          Keep Teams Aligned
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Standardization shouldn’t slow you down—it should free you to move
          faster.
        </SectionHeading>
      </div>
      <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
        <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.name} className="flex flex-col">
              <dt className="text-base/7 font-semibold">
                <div className="mb-6 flex size-10 items-center justify-center rounded-lg bg-blue-500 dark:bg-sky-500">
                  <feature.icon
                    aria-hidden="true"
                    className="size-6 text-white"
                  />
                </div>
                {feature.name}
              </dt>
              <dd className="mt-1 flex flex-auto flex-col text-base/7">
                {feature.description}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
