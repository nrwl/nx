import {
  ArrowPathIcon,
  BoltIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import { ReactElement } from 'react';
import { SectionHeading } from '@nx/nx-dev-ui-common';
import Link from 'next/link';

const features = [
  {
    name: 'Better security posture',
    description: (
      <>
        <p className="flex-auto">
          Quickly identify and address vulnerabilities with Polygraph’s
          cross-repo visibility, and enforce consistent, enterprise-grade
          security standards across teams.
        </p>
        <div className="mt-4">
          <Link
            href="/enterprise/security"
            title="Learn about our Enterprise Grade Security"
            className="text-sm/6 font-semibold"
          >
            Learn about our Enterprise Grade Security{' '}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    icon: ShieldExclamationIcon,
  },
  {
    name: 'Reduce CI waste',
    description: (
      <>
        <p className="flex-auto">
          Speed up pipelines with caching, task splitting, automatic flaky tasks
          retries, and smart distribution.
        </p>
        <div className="mt-4">
          <Link
            href="/ci/intro/ci-with-nx"
            title="Learn how to speed up CI"
            prefetch={false}
            className="text-sm/6 font-semibold"
          >
            Learn how to speed up CI <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    icon: BoltIcon,
  },
  {
    name: 'Automatic flaky task handling',
    description: (
      <>
        <p className="flex-auto">
          Unstable tasks are automatically detected and re-run, so developers
          don’t waste time on false failures.
        </p>
        <div className="mt-4">
          <Link
            href="/ci/features/flaky-tasks"
            title="Learn about Flaky Task Retries"
            className="text-sm/6 font-semibold"
          >
            Learn about Flaky Task Retries <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    icon: ArrowPathIcon,
  },
];

export function ReliableByDesign(): ReactElement {
  return (
    <div
      id="reliable-by-design"
      className="mx-auto max-w-7xl scroll-mt-32 px-6 lg:px-8"
    >
      <div className="mx-auto max-w-2xl lg:mx-0">
        <div className="h-8 w-36 border-t-2 border-pink-500 dark:border-fuchsia-500" />
        <SectionHeading as="h2" variant="title" id="reliable-by-design-title">
          Reliable by Design
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Fewer incidents. Less fire-fighting.
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
