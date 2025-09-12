import {
  ArchiveBoxIcon,
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  CloudArrowUpIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';
import { ReactElement } from 'react';
import { SectionHeading } from '@nx/nx-dev-ui-common';
import Link from 'next/link';

const features = [
  {
    name: 'Never build the same code twice',
    description: (
      <>
        <p className="flex-auto">
          Reduce build times and resource usage by sharing cached results across
          your team and CI pipelines.
        </p>
        <div className="mt-4">
          <Link
            href={
              process.env.NEXT_PUBLIC_ASTRO_URL
                ? '/docs/features/ci-features/remote-cache'
                : '/ci/features/remote-cache'
            }
            title="Learn more about Nx Replay"
            className="text-sm/6 font-semibold"
          >
            Learn more about Nx Replay <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    icon: ArchiveBoxIcon,
  },
  {
    name: 'One less thing to debug',
    description: (
      <>
        <p className="flex-auto">
          Automatically detect and re-run flaky tasks to minimize time spent
          debugging.
        </p>
        <div className="mt-4">
          <Link
            href="/ci/features/flaky-tasks"
            title="Learn more about Flaky Task Retries"
            className="text-sm/6 font-semibold"
          >
            Learn more about Flaky Task Retries{' '}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    icon: ArrowPathIcon,
  },
  {
    name: 'Break tasks down, to speed tests up',
    description: (
      <>
        <p className="flex-auto">
          Split large e2e suites into parallel runs that finish in minutes, not
          hours.
        </p>
        <div className="mt-4">
          <Link
            href="/ci/features/split-e2e-tasks"
            title="Learn about Atomizer"
            className="text-sm/6 font-semibold"
          >
            Learn about Atomizer <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    icon: Squares2X2Icon,
  },
  {
    name: 'Machines, make it fast',
    description: (
      <>
        <p className="flex-auto">
          Dynamically distribute tasks across machines for faster builds and PR
          feedback.
        </p>
        <div className="mt-4">
          <Link
            href="/ci/features/dynamic-agents"
            title="Learn about Nx Agents"
            className="text-sm/6 font-semibold"
          >
            Learn about Nx Agents <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    icon: RocketLaunchIcon,
  },
];

export function AllSpeedNoStress(): ReactElement {
  return (
    <div
      id="all-speed-no-stress"
      className="mx-auto max-w-7xl scroll-mt-32 px-6 lg:px-8"
    >
      <div className="mx-auto max-w-2xl lg:mx-0">
        <div className="h-8 w-36 border-t-2 border-blue-500 dark:border-sky-500" />
        <SectionHeading as="h2" variant="title" id="all-speed-no-stress-title">
          All speed no stress
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Stay in flow with fewer distractions and dramatically faster CI.
        </SectionHeading>
      </div>
      <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
        <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
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
