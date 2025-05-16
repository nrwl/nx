import {
  ClipboardDocumentListIcon,
  EyeIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { ReactElement } from 'react';
import { SectionHeading } from '@nx/nx-dev/ui-common';

const features = [
  {
    name: 'Standardize across the org',
    description: (
      <>
        <p className="flex-auto">
          Establish and enforce consistent development standards so everyone
          builds from the same playbook.
        </p>
      </>
    ),
    icon: ClipboardDocumentListIcon,
  },
  {
    name: 'Break silos, improve collaboration',
    description: (
      <>
        <p className="flex-auto">
          Increase code reuse and cross-team velocity through shared context and
          tooling.
        </p>
      </>
    ),
    icon: UsersIcon,
  },
  {
    name: 'Smarter visibility',
    description: (
      <>
        <p className="flex-auto">
          Understand how everything fits together with tools that map
          relationships, dependencies, and ownership—so you can make decisions
          faster and avoid delays caused by hidden complexity.
        </p>
      </>
    ),
    icon: EyeIcon,
  },
];

export function ScaleSafely(): ReactElement {
  return (
    <div
      id="scale-safely"
      className="mx-auto max-w-7xl scroll-mt-32 px-6 lg:px-8"
    >
      <div className="mx-auto max-w-2xl lg:mx-0">
        <div className="h-8 w-36 border-t-2 border-blue-500 dark:border-sky-500" />
        <SectionHeading as="h2" variant="title" id="scale-safely-title">
          Scale Safely
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Set a foundation that supports growth without introducing operational
          risk.
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
