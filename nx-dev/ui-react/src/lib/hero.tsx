/* eslint-disable @nx/enforce-module-boundaries */
import {
  ButtonLink,
  SectionHeading,
  Strong,
  SectionDescription,
} from '@nx/nx-dev/ui-common';
import { ReactIcon } from '@nx/nx-dev/ui-icons';
/* eslint-enable @nx/enforce-module-boundaries */
import { ReactElement } from 'react';

export function Hero(): ReactElement {
  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        {/* Logo displayed above the title */}
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-slate-100 p-4 dark:bg-slate-800">
            <ReactIcon className="h-20 w-20" />
          </div>
        </div>

        <SectionHeading as="h1" variant="title" className="mt-6">
          Experience the{' '}
          <span className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
            power of Nx
          </span>{' '}
          <br className="hidden md:block" />
          in your{' '}
          <span className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
            React monorepo
          </span>
        </SectionHeading>
        <SectionDescription as="p" className="mt-6">
          Get distributed tasks, intelligent caching, and target affected
          <br />
          packages to optimize your build process and CI pipeline.
        </SectionDescription>

        <div className="mt-10 flex flex-col items-center justify-center gap-6 sm:flex-row">
          <ButtonLink
            href="/getting-started/tutorials/react-monorepo-tutorial"
            variant="primary"
            size="default"
            title="Get Started"
          >
            Get Started with Nx for React
          </ButtonLink>

          <a
            href="https://github.com/nrwl/nx-recipes/tree/main/react-monorepo"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center text-sm font-semibold leading-6 text-slate-800 dark:text-white"
          >
            View Example Project{' '}
            <span
              aria-hidden="true"
              className="ml-1 inline-block transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}

export function GettingStarted(): ReactElement {
  return (
    <section className="relative py-16 sm:py-24">
      <div className="absolute inset-0 bg-white dark:bg-slate-900"></div>
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Add Nx To An Existing Project
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-3 ">
          <GetStartedCard
            title="Add Nx To Your Project"
            command="npx init nx"
            description="Initialize Nx in an existing React Project"
          />
          <GetStartedCard
            title="Run Tasks With Nx"
            command="nx build <project>"
            description="Nx will automatically infers tasks from your projects."
          />

          <GetStartedCard
            title="Run Affected Tasks"
            command="nx affected -t build"
            description="Nx adds caching, distribution, and affected commands without changing your setup."
          />
        </div>

        {/* GitHub example project link */}
        <div className="mt-12 flex justify-center">
          <a
            href="https://github.com/nrwl/nx-recipes/tree/main/react-monorepo"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-3 font-medium text-slate-900 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-400 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:border-blue-500"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2C6.477 2 2 6.477 2 12C2 16.418 4.865 20.166 8.839 21.489C9.339 21.581 9.521 21.284 9.521 21.029C9.521 20.799 9.513 20.065 9.508 19.27C6.726 19.891 6.139 17.962 6.139 17.962C5.685 16.812 5.029 16.516 5.029 16.516C4.121 15.89 5.098 15.902 5.098 15.902C6.101 15.97 6.629 16.925 6.629 16.925C7.521 18.43 8.97 18.008 9.539 17.762C9.631 17.097 9.889 16.676 10.175 16.419C7.954 16.159 5.62 15.304 5.62 11.453C5.62 10.355 6.009 9.457 6.649 8.758C6.546 8.514 6.203 7.543 6.746 6.161C6.746 6.161 7.585 5.902 9.497 7.203C10.295 6.988 11.15 6.88 12 6.876C12.85 6.88 13.705 6.988 14.505 7.203C16.415 5.902 17.253 6.161 17.253 6.161C17.798 7.543 17.455 8.514 17.352 8.758C17.994 9.457 18.38 10.355 18.38 11.453C18.38 15.313 16.042 16.156 13.815 16.411C14.174 16.726 14.495 17.347 14.495 18.297C14.495 19.648 14.483 20.709 14.483 21.029C14.483 21.287 14.661 21.586 15.171 21.487C19.138 20.161 22 16.417 22 12C22 6.477 17.523 2 12 2Z"
                fill="currentColor"
              />
            </svg>
            View Example Project on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

interface GetStartedCardProps {
  title: string;
  command: string;
  description: string;
}

function GetStartedCard({
  title,
  command,
  description,
}: GetStartedCardProps): ReactElement {
  return (
    <div className="h-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <h3 className="text-lg font-medium text-slate-900 dark:text-white">
        {title}
      </h3>
      <div className="mt-3 overflow-hidden rounded-md bg-slate-800 px-4 py-3 text-sm text-white dark:bg-slate-950">
        <code style={{ whiteSpace: 'pre-line' }}>{command}</code>
      </div>
      <p
        className="mt-3 text-sm text-slate-600 dark:text-slate-300"
        dangerouslySetInnerHTML={{ __html: description }}
      ></p>
    </div>
  );
}
