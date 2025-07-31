import {
  ArrowPathIcon,
  LockClosedIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { ReactElement } from 'react';
import { SectionHeading } from '@nx/nx-dev-ui-common';
import Link from 'next/link';

const features = [
  {
    name: 'Enable AI-assisted development',
    description: (
      <>
        <p className="flex-auto">
          Make LLMs and internal tooling smarter by providing real-time
          architecture and usage context, giving your teams a strategic edge in
          how quickly and confidently they can ship.
        </p>
        <div className="mt-4">
          <Link
            href="/features/enhance-AI"
            title="Learn about our Enhancing your LLM"
            className="text-sm/6 font-semibold"
          >
            Learn about our Enhancing your LLM <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    icon: SparklesIcon,
  },
  {
    name: 'Ensure security and compliance',
    description: (
      <>
        <p className="flex-auto">
          Quickly surface issues and roll out org-wide fixes with built-in
          controls and governance.
        </p>
      </>
    ),
    icon: LockClosedIcon,
  },
  {
    name: 'Future-proof your stack',
    description: (
      <>
        <p className="flex-auto">
          Stay flexible with a platform that integrates with your current setup
          and evolves with your needs.
        </p>
      </>
    ),
    icon: ArrowPathIcon,
  },
];

export function BuildAModernEngineeringOrganization(): ReactElement {
  return (
    <div
      id="build-a-modern-engineering-org"
      className="mx-auto max-w-7xl scroll-mt-32 px-6 lg:px-8"
    >
      <div className="mx-auto max-w-2xl lg:mx-0">
        <div className="h-8 w-36 border-t-2 border-pink-500 dark:border-fuchsia-500" />
        <SectionHeading
          as="h2"
          variant="title"
          id="build-a-modern-engineering-org-title"
        >
          Build a Modern Engineering Org
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Enable the next generation of developer workflows and team
          collaboration.
        </SectionHeading>
      </div>
      <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
        <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.name} className="flex flex-col">
              <dt className="text-base/7 font-semibold">
                <div className="mb-6 flex size-10 items-center justify-center rounded-lg bg-pink-500 dark:bg-fuchsia-500">
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
