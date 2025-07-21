import {
  ArchiveBoxIcon,
  LinkIcon,
  ScaleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { ReactElement } from 'react';
import { SectionHeading } from '@nx/nx-dev-ui-common';
import Link from 'next/link';

const features = [
  {
    name: 'Simple CI, out of the box',
    description: (
      <>
        <p className="flex-auto">
          Reduce maintenance for platform teams and avoid tech debt with
          built-in solutions that work across projects and repos.
        </p>
      </>
    ),
    icon: ArchiveBoxIcon,
  },
  {
    name: 'Easy integration with existing tools',
    description: (
      <>
        <p className="flex-auto">
          Seamlessly integrate with any repo structure and CI provider.
        </p>
        <div className="mt-4">
          <Link
            href="/ci/intro/ci-with-nx"
            title="Get started with your existing CI provider"
            prefetch={false}
            className="text-sm/6 font-semibold"
          >
            Get started with your existing CI provider
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </>
    ),
    icon: LinkIcon,
  },
  {
    name: 'Standardize and refactor at scale',
    description: (
      <>
        <p className="flex-auto">
          Use Polygraph to gain visibility of dependencies across teams and
          repos, enforce conformance rules, and easily roll out updates across
          all repos.
        </p>
      </>
    ),
    icon: ScaleIcon,
  },
  {
    name: 'Reliable pipelines, fewer headaches',
    description: (
      <>
        <p className="flex-auto">
          Get consistent CI runs with less flakiness and better performance.
        </p>
      </>
    ),
    icon: ShieldCheckIcon,
  },
];

export function EasyToAdoptEasyToMaintain(): ReactElement {
  return (
    <div
      id="easy-to-adopt-easy-to-maintain"
      className="mx-auto max-w-7xl scroll-mt-32 px-6 lg:px-8"
    >
      <div className="mx-auto max-w-2xl lg:mx-0">
        <div className="h-8 w-36 border-t-2 border-blue-500 dark:border-sky-500" />
        <SectionHeading
          as="h2"
          variant="title"
          id="easy-to-adopt-easy-to-maintain-title"
        >
          Easy to Adopt, Easy to Maintain
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Your team shouldn't have to build developer infrastructure from
          scratch.
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
