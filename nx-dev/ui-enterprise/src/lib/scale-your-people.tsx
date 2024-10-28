import {
  BuildingOffice2Icon,
  Cog6ToothIcon,
  CubeTransparentIcon,
  IdentificationIcon,
  SquaresPlusIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { SectionHeading } from '@nx/nx-dev/ui-common';

export function ScaleYourPeople(): JSX.Element {
  return (
    <section id="scale-your-people">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading as="h2" variant="title">
            Scale your people
          </SectionHeading>
        </div>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Build big things with the efficiency of a small team by increasing
          collaboration and developer mobility, reducing wait time and
          duplication, and establishing clear ownership.
        </SectionHeading>
        <div className="mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-2 md:gap-y-16 lg:max-w-none lg:grid-cols-4">
          <div className="relative rounded-md bg-slate-100 px-4 py-3 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
            <div className="flex items-center gap-3 text-lg font-medium leading-6">
              <CubeTransparentIcon
                aria-hidden="true"
                className="h-5 w-5 flex-none"
              />
              Visibility
            </div>
            <svg
              aria-hidden="true"
              viewBox="0 0 4 12"
              fill="currentColor"
              className="absolute right-0 top-1/2 hidden h-6 w-2 -translate-y-1/2 translate-x-full transform text-slate-100 lg:block dark:text-slate-800"
            >
              <path
                d="M3.26 4.9a2 2 0 0 1 0 2.2L0 12V0l3.26 4.9z"
                fillRule="evenodd"
              />
            </svg>
          </div>
          <div className="relative rounded-md bg-slate-100 px-4 py-3 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
            <svg
              aria-hidden="true"
              viewBox="0 0 4 12"
              fill="currentColor"
              className="absolute left-0 top-1/2 hidden h-6 w-2 -translate-y-1/2 transform text-white lg:block dark:text-slate-950"
            >
              <path
                d="M3.26 4.9a2 2 0 0 1 0 2.2L0 12V0l3.26 4.9z"
                fillRule="evenodd"
              />
            </svg>
            <div className="flex items-center gap-3 text-lg font-medium leading-6">
              <IdentificationIcon
                aria-hidden="true"
                className="h-5 w-5 flex-none"
              />
              Ownership
            </div>
            <svg
              aria-hidden="true"
              viewBox="0 0 4 12"
              fill="currentColor"
              className="absolute right-0 top-1/2 hidden h-6 w-2 -translate-y-1/2 translate-x-full transform text-slate-100 lg:block dark:text-slate-800"
            >
              <path
                d="M3.26 4.9a2 2 0 0 1 0 2.2L0 12V0l3.26 4.9z"
                fillRule="evenodd"
              />
            </svg>
          </div>
          <div className="relative rounded-md bg-slate-100 px-4 py-3 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
            <svg
              aria-hidden="true"
              viewBox="0 0 4 12"
              fill="currentColor"
              className="absolute left-0 top-1/2 hidden h-6 w-2 -translate-y-1/2 transform text-white lg:block dark:text-slate-950"
            >
              <path
                d="M3.26 4.9a2 2 0 0 1 0 2.2L0 12V0l3.26 4.9z"
                fillRule="evenodd"
              />
            </svg>
            <div className="flex items-center gap-3 text-lg font-medium leading-6">
              <UserGroupIcon aria-hidden="true" className="h-5 w-5 flex-none" />
              Control
            </div>
            <svg
              aria-hidden="true"
              viewBox="0 0 4 12"
              fill="currentColor"
              className="absolute right-0 top-1/2 hidden h-6 w-2 -translate-y-1/2 translate-x-full transform text-slate-100 lg:block dark:text-slate-800"
            >
              <path
                d="M3.26 4.9a2 2 0 0 1 0 2.2L0 12V0l3.26 4.9z"
                fillRule="evenodd"
              />
            </svg>
          </div>
          <div className="relative rounded-md bg-slate-100 px-4 py-3 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
            <svg
              aria-hidden="true"
              viewBox="0 0 4 12"
              fill="currentColor"
              className="absolute left-0 top-1/2 hidden h-6 w-2 -translate-y-1/2 transform text-white lg:block dark:text-slate-950"
            >
              <path
                d="M3.26 4.9a2 2 0 0 1 0 2.2L0 12V0l3.26 4.9z"
                fillRule="evenodd"
              />
            </svg>
            <div className="flex items-center gap-3 text-lg font-medium leading-6">
              <Cog6ToothIcon aria-hidden="true" className="h-5 w-5 flex-none" />
              Automation
            </div>
          </div>
        </div>
        <picture className="block py-12">
          <img
            src="/images/enterprise/graphs.jpg"
            alt="Product screenshot"
            className="mx-auto max-w-full rounded-xl shadow-xl ring-1 ring-slate-400/10"
            width={2500}
            height={1616}
          />
        </picture>
        <div className="relative mx-auto mt-16 max-w-2xl space-y-12 sm:mt-20">
          <svg
            className="absolute left-0 top-0 -z-10 -ml-20 hidden -translate-x-full -translate-y-1/2 transform lg:block"
            width={200}
            height={400}
            fill="none"
            viewBox="0 0 200 400"
            aria-hidden="true"
          >
            <defs>
              <pattern
                id="de316486-4a29-4312-bdfc-fbce2132a2c1"
                x={0}
                y={0}
                width={20}
                height={20}
                patternUnits="userSpaceOnUse"
              >
                <rect
                  x={0}
                  y={0}
                  width={4}
                  height={4}
                  className="text-slate-100 dark:text-slate-800/60"
                  fill="currentColor"
                />
              </pattern>
            </defs>
            <rect
              width={200}
              height={400}
              fill="url(#de316486-4a29-4312-bdfc-fbce2132a2c1)"
            />
          </svg>
          <svg
            className="absolute bottom-0 right-0 -z-10 -mr-20 hidden translate-x-full translate-y-1/2 transform lg:block"
            width={200}
            height={400}
            fill="none"
            viewBox="0 0 200 400"
            aria-hidden="true"
          >
            <defs>
              <pattern
                id="de316486-4a29-4312-bdfc-fbce2132a2c1"
                x={0}
                y={0}
                width={20}
                height={20}
                patternUnits="userSpaceOnUse"
              >
                <rect
                  x={0}
                  y={0}
                  width={4}
                  height={4}
                  className="text-slate-100 dark:text-slate-800/60"
                  fill="currentColor"
                />
              </pattern>
            </defs>
            <rect
              width={200}
              height={400}
              fill="url(#de316486-4a29-4312-bdfc-fbce2132a2c1)"
            />
          </svg>
          <div className="space-y-6 lg:space-y-12">
            <div className="flex justify-center">
              <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30">
                coming soon
              </span>
            </div>
            <div className="flex items-start gap-6">
              <div className="rounded-full p-3 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800/60">
                <SquaresPlusIcon className="h-5 w-5 text-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <h4 className="relative text-base font-medium leading-6 text-slate-900 dark:text-slate-100">
                  Monorepo, polyrepo, multi-monorepo?
                </h4>
                <p className="mt-2">
                  Whatever you’re working with, Nx Enterprise will give you the
                  visibility you need to understand what they have in common,
                  how they relate, and how they differ.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-6">
              <div className="rounded-full p-3 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800/60">
                <Cog6ToothIcon className="h-5 w-5 text-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <h4 className="relative text-base font-medium leading-6 text-slate-900 dark:text-slate-100">
                  Monorepo experience in a polyrepo environment
                </h4>
                <p className="mt-2">
                  Nx Enterprise will support optional monorepo-like constraints
                  to be applied across Nx Workspace boundaries in a seamless and
                  flexible way. Move fast with confidence.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-6">
              <div className="rounded-full p-3 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800/60">
                <BuildingOffice2Icon className="h-5 w-5 text-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <h4 className="relative text-base font-medium leading-6 text-slate-900 dark:text-slate-100">
                  Automation over coordination
                </h4>
                <p className="mt-2">
                  Testing and cross-repo coordination can be left to Nx
                  Enterprise tooling instead of manual human intervention to
                  test and enforce cross-repo dependencies & constraints.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
