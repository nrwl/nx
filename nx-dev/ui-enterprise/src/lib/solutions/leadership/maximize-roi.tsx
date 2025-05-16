import {
  BanknotesIcon,
  BoltIcon,
  BugAntIcon,
} from '@heroicons/react/24/outline';
import { ReactElement } from 'react';
import { SectionHeading } from '@nx/nx-dev/ui-common';

const features = [
  {
    name: 'Reduce CI costs',
    description: (
      <p className="flex-auto">
        Avoid over-provisioning and eliminate redundant work with smarter task
        distribution and caching.
      </p>
    ),
    icon: BanknotesIcon,
  },
  {
    name: 'Faster time to market',
    description: (
      <>
        <p className="flex-auto">
          Speed up iteration cycles, reduce delivery bottlenecks, and gain a
          competitive edge by getting value to customers faster.
        </p>
      </>
    ),
    icon: BoltIcon,
  },
  {
    name: 'Minimize the cost of failure',
    description: (
      <>
        <p className="flex-auto">
          Shift problem detection earlier in the process—with real-time
          feedback—to reduce the impact of bugs and regressions
        </p>
      </>
    ),
    icon: BugAntIcon,
  },
];

export function MaximizeRoi(): ReactElement {
  return (
    <div
      id="maximize-roi"
      className="mx-auto max-w-7xl scroll-mt-32 px-6 lg:px-8"
    >
      <div className="mx-auto max-w-2xl lg:mx-0">
        <div className="h-8 w-36 border-t-2 border-green-500" />
        <SectionHeading as="h2" variant="title" id="maximize-roi-title">
          Maximize ROI
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Free up engineering capacity and increase the return on every build
          minute.
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
