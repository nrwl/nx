import {
  EyeIcon,
  LinkIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/outline';
import { ReactElement } from 'react';
import { SectionHeading } from '@nx/nx-dev/ui-common';

const features = [
  {
    name: 'Execute large, cross-team changes',
    description: (
      <p className="flex-auto">
        Coordinate and fully automate updates across multiple repositories,
        teams, or lines of business without slowing down.
      </p>
    ),
    icon: RocketLaunchIcon,
  },
  {
    name: 'Break down silos',
    description: (
      <>
        <p className="flex-auto">
          Enable developers to work across teams more effectively and reuse code
          confidently.
        </p>
      </>
    ),
    icon: LinkIcon,
  },
  {
    name: 'Understand impact across teams',
    description: (
      <>
        <p className="flex-auto">
          Understand where shared libraries are used and how changes impact
          other teams.
        </p>
      </>
    ),
    icon: EyeIcon,
  },
];

export function ScaleWithEase(): ReactElement {
  return (
    <div
      id="scale-with-ease"
      className="mx-auto max-w-7xl scroll-mt-32 px-6 lg:px-8"
    >
      <div className="mx-auto max-w-2xl lg:mx-0">
        <div className="h-8 w-36 border-t-2 border-pink-500 dark:border-fuchsia-500" />
        <SectionHeading as="h2" variant="title" id="scale-with-ease-title">
          Scale With Ease
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Your org is growing. Keep delivery velocity high without getting
          bogged down by team growth.
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
