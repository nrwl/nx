import { ReactElement } from 'react';
import { LinuxIcon, WindowsIcon } from '@nx/nx-dev-ui-icons';
import { SectionDescription, SectionHeading } from '@nx/nx-dev-ui-common';

const nonComputeItems = [
  {
    name: 'CI Pipeline Execution',
    description:
      'A CI Pipeline Execution is a CI run or a Workflow run (depending on your CI provider). For instance, running a PR or running CI on the main branch are CI Pipeline Executions.',
    creditCost: 500,
    suffix: 'execution',
  },
];

const linuxAmd64 = [
  {
    icon: <LinuxIcon aria-hidden="true" className="size-6" />,
    name: 'Small',
    description: '1 vCPU, 2GB RAM',
    creditCost: 5,
  },
  {
    icon: <LinuxIcon aria-hidden="true" className="size-6" />,
    name: 'Medium',
    description: '2 vCPU, 4GB RAM',
    creditCost: 10,
  },
  {
    icon: <LinuxIcon aria-hidden="true" className="size-6" />,
    name: 'Medium +',
    description: '3 vCPU, 6GB RAM',
    creditCost: 15,
  },
  {
    icon: <LinuxIcon aria-hidden="true" className="size-6" />,
    name: 'Large',
    description: '4 vCPU, 8GB RAM',
    creditCost: 20,
  },
  {
    icon: <LinuxIcon aria-hidden="true" className="size-6" />,
    name: 'Large +',
    description: '4 vCPU, 10GB RAM',
    creditCost: 30,
  },
  {
    icon: <LinuxIcon aria-hidden="true" className="size-6" />,
    name: 'Extra large',
    description: '8 vCPU, 16GB RAM',
    creditCost: 40,
  },
  {
    icon: <LinuxIcon aria-hidden="true" className="size-6" />,
    name: 'Extra large +',
    description: '10 vCPU, 20GB RAM',
    creditCost: 60,
  },
];

const linuxArm64 = [
  {
    icon: <LinuxIcon aria-hidden="true" className="size-6" />,
    name: 'Medium',
    description: '2 vCPU, 8GB RAM',
    creditCost: 13,
  },
  {
    icon: <LinuxIcon aria-hidden="true" className="size-6" />,
    name: 'Large',
    description: '4 vCPU, 16GB RAM',
    creditCost: 26,
  },
  {
    icon: <LinuxIcon aria-hidden="true" className="size-6" />,
    name: 'Extra large',
    description: '8 vCPU, 32GB RAM',
    creditCost: 52,
  },
];

const windows = [
  {
    icon: <WindowsIcon aria-hidden="true" className="size-6" />,
    name: 'Medium',
    description: '3 vCPU, 6GB RAM',
    creditCost: 40,
  },
];

export function CreditPricing(): ReactElement {
  return (
    <section
      id="resource-classes"
      className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
    >
      <header>
        <div className="mx-auto max-w-4xl text-center">
          <SectionHeading as="h2" variant="title">
            Credit pricing
          </SectionHeading>
        </div>
      </header>

      <div className="mx-auto mt-10 max-w-full space-y-12 sm:mt-20">
        <SectionHeading as="h3" variant="subtitle">
          Non-compute pricing
        </SectionHeading>
        <div>
          <ul role="list" className="mt-4 space-y-4 sm:space-y-6">
            {nonComputeItems.map((project) => (
              <li
                key={project.name}
                className="col-span-1 flex overflow-hidden rounded-md border border-slate-200 shadow-sm dark:border-slate-800"
              >
                <div className="flex flex-1 items-center justify-between bg-white dark:bg-slate-900">
                  <div className="flex-1 px-4 py-2 text-sm">
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {project.name}
                    </span>
                    <p className="text-xs text-slate-500">
                      {project.description}
                    </p>
                  </div>
                  <div className="shrink-0 pr-4 text-sm font-semibold">
                    <span>
                      {new Intl.NumberFormat('en-US', {
                        style: 'decimal',
                      }).format(project.creditCost)}{' '}
                      credits/{project.suffix}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <SectionHeading as="h3" variant="subtitle">
          Agents resource classes
        </SectionHeading>
        <div>
          <SectionDescription as="h3">Docker / Linux AMD64</SectionDescription>
          <ul
            role="list"
            className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
          >
            {linuxAmd64.map((project) => (
              <li
                key={project.name}
                className="col-span-1 flex overflow-hidden rounded-md border border-slate-200 shadow-sm dark:border-slate-800"
              >
                <div className="flex w-16 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-50 text-sm font-medium dark:border-slate-800 dark:bg-slate-800">
                  {project.icon}
                </div>
                <div className="flex flex-1 items-center justify-between truncate bg-white dark:bg-slate-900">
                  <div className="flex-1 truncate px-4 py-2 text-sm">
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {project.name}
                    </span>
                    <p className="text-xs text-slate-500">
                      {project.description}
                    </p>
                  </div>
                  <div className="shrink-0 pr-4 text-sm font-semibold">
                    <span>
                      {new Intl.NumberFormat('en-US', {
                        style: 'decimal',
                      }).format(project.creditCost)}{' '}
                      credits/min
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <SectionDescription as="h3">Docker / Linux ARM64</SectionDescription>
          <ul
            role="list"
            className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
          >
            {linuxArm64.map((project) => (
              <li
                key={project.name}
                className="col-span-1 flex overflow-hidden rounded-md border border-slate-200 shadow-sm dark:border-slate-800"
              >
                <div className="flex w-16 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-50 text-sm font-medium dark:border-slate-800 dark:bg-slate-800">
                  {project.icon}
                </div>
                <div className="flex flex-1 items-center justify-between truncate bg-white dark:bg-slate-900">
                  <div className="flex-1 truncate px-4 py-2 text-sm">
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {project.name}
                    </span>
                    <p className="text-xs text-slate-500">
                      {project.description}
                    </p>
                  </div>
                  <div className="shrink-0 pr-4 text-sm font-semibold">
                    <span>{project.creditCost} credits/min</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <SectionDescription as="h3">Docker / Windows</SectionDescription>
          <ul
            role="list"
            className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
          >
            {windows.map((project) => (
              <li
                key={project.name}
                className="col-span-1 flex overflow-hidden rounded-md border border-slate-200 shadow-sm dark:border-slate-800"
              >
                <div className="flex w-16 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-50 text-sm font-medium dark:border-slate-800 dark:bg-slate-800">
                  {project.icon}
                </div>
                <div className="flex flex-1 items-center justify-between truncate bg-white dark:bg-slate-900">
                  <div className="flex-1 truncate px-4 py-2 text-sm">
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {project.name}
                    </span>
                    <p className="text-xs text-slate-500">
                      {project.description}
                    </p>
                  </div>
                  <div className="shrink-0 pr-4 text-sm font-semibold">
                    <span>{project.creditCost} credits/min</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
