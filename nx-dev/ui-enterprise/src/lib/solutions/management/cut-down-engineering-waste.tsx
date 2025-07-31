import {
  BoltIcon,
  CheckCircleIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';
import { ReactElement } from 'react';
import { SectionHeading } from '@nx/nx-dev-ui-common';
import Link from 'next/link';

const features = [
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
    name: 'Fewer incorrect implementations',
    description: (
      <>
        <p className="flex-auto">
          Tight feedback loops and shared context enable teams to make smaller,
          better-timed changes that land right the first time.
        </p>
      </>
    ),
    icon: CheckCircleIcon,
  },
  {
    name: 'Speed up decision-making with AI',
    description: (
      <>
        <p className="flex-auto">
          Derive project graphs to reveal architectural context and change
          impact cross-repo so teams can move quickly–and with confidence.
        </p>
      </>
    ),
    icon: LightBulbIcon,
  },
];

export function CutDownEngineeringWaste(): ReactElement {
  return (
    <div
      id="cut-down-engineering-waste"
      className="mx-auto max-w-7xl scroll-mt-32 px-6 lg:px-8"
    >
      <div className="mx-auto max-w-2xl lg:mx-0">
        <div className="h-8 w-36 border-t-2 border-green-500" />
        <SectionHeading
          as="h2"
          variant="title"
          id="cut-down-engineering-waste-title"
        >
          Cut Down Engineering Waste
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Prevent issues before they become months-long rework.
        </SectionHeading>
      </div>
      <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
        <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.name} className="flex flex-col">
              <dt className="text-base/7 font-semibold">
                <div className="mb-6 flex size-10 items-center justify-center rounded-lg bg-green-500">
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
