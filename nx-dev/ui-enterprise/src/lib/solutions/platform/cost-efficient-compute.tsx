import {
  AdjustmentsHorizontalIcon,
  FunnelIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline';
import { ReactElement } from 'react';
import { SectionHeading } from '@nx/nx-dev/ui-common';
import Link from 'next/link';

const features = [
  {
    name: 'Use only what is needed',
    description: (
      <p className="flex-auto">
        Nx runs only{' '}
        <Link
          href="/ci/features/affected"
          title="Nx affected tasks"
          prefetch={false}
          className="underline"
        >
          affected tasks
        </Link>{' '}
        and caches results to cut down compute usage.
      </p>
    ),
    icon: FunnelIcon,
  },
  {
    name: 'Smarter compute distribution',
    description: (
      <>
        <p className="flex-auto">
          Dynamically allocate just the right number of efficient sized machines
          to get good performance and avoid over-provisioning.
        </p>
        <div className="mt-4">
          <Link
            href="/ci/features/distribute-task-execution"
            title="Learn about Nx Agents"
            className="text-sm/6 font-semibold"
          >
            Learn about Nx Agents <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    icon: AdjustmentsHorizontalIcon,
  },
  {
    name: 'Reliable execution on flexible infrastructure',
    description: (
      <>
        <p className="flex-auto">
          Run CI on spot instances or other low-cost infrastructure without
          sacrificing stability.
        </p>
      </>
    ),
    icon: ServerStackIcon,
  },
];

export function CostEfficientCompute(): ReactElement {
  return (
    <div
      id="cost-efficient-compute-without-sacrificing-speed"
      className="mx-auto max-w-7xl scroll-mt-32 px-6 lg:px-8"
    >
      <div className="mx-auto max-w-2xl lg:mx-0">
        <div className="h-8 w-36 border-t-2 border-green-500" />
        <SectionHeading
          as="h2"
          variant="title"
          id="cost-efficient-compute-without-sacrificing-speed-title"
        >
          Cost-Efficient Compute – Without Sacrificing Speed
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Reduce infrastructure costs without compromising performance.
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
