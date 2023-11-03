import {
  AcademicCapIcon,
  BeakerIcon,
  ChartBarIcon,
  CloudArrowDownIcon,
  CubeTransparentIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline';
import { CogIcon } from '@heroicons/react/24/solid';
import { SectionHeading } from '@nx/nx-dev/ui-common';
import {
  animate,
  motion,
  MotionValue,
  useAnimation,
  useMotionValue,
  useTransform,
} from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useInView } from 'react-intersection-observer';

export function Workflows(): JSX.Element {
  return (
    <article
      id="nx-is-fast"
      className="relative bg-slate-50 py-28 dark:bg-slate-800/40"
    >
      <div className="mx-auto max-w-7xl px-4 pt-12 sm:grid sm:grid-cols-3 sm:gap-8 sm:px-6 lg:px-8 lg:pt-16">
        <div className="sm:col-span-2">
          <header>
            <SectionHeading as="h1" variant="title" id="nx-is-fast">
              Nx Workflows
            </SectionHeading>
            <SectionHeading
              as="p"
              variant="display"
              id="nx-is-fast"
              className="mt-4"
            >
              Maintain peak CI performance, <br /> while focusing on growth
            </SectionHeading>
          </header>
          <div className="mt-8 flex gap-16 font-normal">
            <p className="max-w-xl text-lg text-slate-700 dark:text-slate-400">
              Nx Workflows stands as our performant CI integration,{' '}
              <span className="font-medium">
                ensuring top-tier performance and scalability every step of the
                way
              </span>
              . Workflows leverage all Nx features and metadata it has about how
              your code is built to find the most efficient way to compute
              tasks.
            </p>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8 lg:pt-16">
        <dl className="grid grid-cols-1 gap-16 sm:grid-cols-2">
          <div key="Never rebuild the same code twice" className="group">
            <dt>
              <div className="relative flex h-12 w-12">
                <CogIcon
                  className="h-8 w-8 text-blue-500 dark:text-sky-500"
                  aria-hidden="true"
                />
                <CloudArrowDownIcon
                  className="absolute -top-2 -right-4 h-8 w-8 text-purple-500 opacity-0 transition-opacity group-hover:opacity-100 dark:text-fuchsia-500"
                  aria-hidden="true"
                />
                <CogIcon
                  className="absolute bottom-0 right-0 h-8 w-8 text-purple-500 opacity-0 transition-opacity group-hover:opacity-100 group-hover:motion-safe:animate-spin dark:text-fuchsia-500"
                  aria-hidden="true"
                />
              </div>
              <p className="relative mt-4 text-base font-medium leading-6 text-slate-900 dark:text-slate-100">
                <span className="absolute -left-4 h-full w-0.5 bg-blue-500 dark:bg-sky-500"></span>
                Seamless setups, that scale
              </p>
            </dt>
            <dd className="mt-2 text-base text-slate-500 dark:text-slate-400">
              Nx Workflows ensures every agent benefits from cached setup steps,
              paving the way for uniform and rapid starts, irrespective of
              project count.
            </dd>
          </div>
          <div key="Distributed task execution" className="group">
            <dt>
              <div className="relative flex h-12 w-12">
                <ServerStackIcon
                  className="h-8 w-8 text-blue-500 dark:text-sky-500"
                  aria-hidden="true"
                />
                <CogIcon
                  className="absolute bottom-0 right-0 h-8 w-8 text-purple-500 opacity-0 transition-opacity group-hover:opacity-100 group-hover:motion-safe:animate-spin dark:text-fuchsia-500"
                  aria-hidden="true"
                />
              </div>
              <p className="relative mt-4 text-base font-medium leading-6 text-slate-900 dark:text-slate-100">
                <span className="absolute -left-4 h-full w-0.5 bg-blue-500 dark:bg-sky-500"></span>
                Task management at its peak
              </p>
            </dt>
            <dd className="mt-2 text-base text-slate-500 dark:text-slate-400">
              Nx Workflows make Distributed Task Execution (DTE) usage simple,
              ensuring tasks are optimally distributed and executed, no matter
              the workload.
            </dd>
          </div>
          <div key="Computation caching" className="group">
            <dt>
              <div className="relative flex h-12 w-12">
                <CloudArrowDownIcon
                  className="h-8 w-8 text-blue-500 dark:text-sky-500"
                  aria-hidden="true"
                />
                <CubeTransparentIcon
                  className="absolute inset-0 h-8 w-8 text-purple-500 opacity-0 transition-all group-hover:translate-x-8 group-hover:-translate-y-1 group-hover:opacity-100 dark:text-fuchsia-500"
                  aria-hidden="true"
                />
                <CubeTransparentIcon
                  className="5 absolute inset-0 h-8 w-8 text-purple-500 opacity-0 transition-all group-hover:translate-x-5 group-hover:translate-y-6 group-hover:opacity-100 dark:text-fuchsia-500"
                  aria-hidden="true"
                />
              </div>
              <p className="relative mt-4 text-base font-medium leading-6 text-slate-900 dark:text-slate-100">
                <span className="absolute -left-4 h-full w-0.5 bg-blue-500 dark:bg-sky-500"></span>
                Zero redundancy, pure efficiency
              </p>
            </dt>
            <dd className="mt-2 text-base text-slate-500 dark:text-slate-400">
              Distributed caching in Nx Workflows eliminates repetitive builds,
              ensuring swift outcomes even as projects multiply.
            </dd>
          </div>
          <div key="Efficient execution" className="group">
            <dt>
              <div className="relative flex h-12 w-12">
                <AcademicCapIcon
                  className="h-8 w-8 text-blue-500 dark:text-sky-500"
                  aria-hidden="true"
                />
                <BeakerIcon
                  className="absolute inset-0 h-8 w-8 text-purple-500 opacity-0 transition-all group-hover:translate-x-8 group-hover:-translate-y-1 group-hover:opacity-100 dark:text-fuchsia-500"
                  aria-hidden="true"
                />
                <ChartBarIcon
                  className="5 absolute inset-0 h-8 w-8 text-purple-500 opacity-0 transition-all group-hover:translate-x-5 group-hover:translate-y-6 group-hover:opacity-100 dark:text-fuchsia-500"
                  aria-hidden="true"
                />
              </div>
              <p className="relative mt-4 text-base font-medium leading-6 text-slate-900 dark:text-slate-100">
                <span className="absolute -left-4 h-full w-0.5 bg-blue-500 dark:bg-sky-500"></span>
                Resources that adapt with you
              </p>
            </dt>
            <dd className="mt-2 text-base text-slate-500 dark:text-slate-400">
              Dynamic agent sizing ensures that as your projects grow, resources
              are allocated perfectly, maintaining peak performance.
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
