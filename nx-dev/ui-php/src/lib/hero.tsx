/* eslint-disable @nx/enforce-module-boundaries */
import {
  ButtonLink,
  SectionHeading,
  Strong,
  SectionDescription,
} from '@nx/nx-dev/ui-common';
import { PHPIcon } from '@nx/nx-dev/ui-icons';
/* eslint-enable @nx/enforce-module-boundaries */
import { type ReactElement } from 'react';

export function Hero(): ReactElement {
  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        {/* Logo displayed above the title */}
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-slate-100 p-4 dark:bg-slate-800">
            <PHPIcon className="h-20 w-20" />
          </div>
        </div>

        <SectionHeading as="h1" variant="title" className="mt-6">
          Supercharge Your PHP Projects
        </SectionHeading>
        <SectionDescription as="h2" className="mt-6">
          Get distributed tasks, intelligent caching, and target affected
          packages to optimize your build process and CI pipeline. Support for{' '}
          <Strong>Composer</Strong> and <Strong>PHPUnit</Strong>
        </SectionDescription>

        <div className="mt-10 flex flex-col items-center justify-center gap-6 sm:flex-row">
          <ButtonLink
            href="https://nx.dev/getting-started/tutorials/php-tutorial"
            variant="primary"
            size="default"
            title="Get Started"
          >
            Get Started with Nx for PHP
          </ButtonLink>

          <a
            href="https://github.com/nrwl/nx-recipes/tree/main/php"
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
