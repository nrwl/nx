import { ButtonLink, SectionHeading } from '@nx/nx-dev/ui-common';
import Link from 'next/link';

export function MigrationsAndCodeGeneration(): JSX.Element {
  return (
    <article
      id="affected-and-code-generation"
      className="relative overflow-hidden bg-slate-50 py-28 dark:bg-slate-800/40"
    >
      <div className="mx-auto max-w-7xl py-12 px-4 sm:grid sm:grid-cols-2 sm:gap-8 sm:px-6 lg:py-16 lg:px-8">
        <div>
          <header>
            <SectionHeading as="h1" variant="title" id="evergreen-setup">
              Evergreen setup
            </SectionHeading>
            <SectionHeading
              as="p"
              variant="display"
              id="nx-is-fast"
              className="mt-4"
            >
              Stay up to date, without effort
            </SectionHeading>
          </header>
          <div className="mt-8 flex gap-16 font-normal">
            <p className="max-w-xl text-lg text-slate-700 dark:text-slate-400">
              Keeping your stack up to date can be a struggle. Nx comes with a
              smart system that is capable of automatically upgrading your
              codebase. Think of it like{' '}
              <span className="font-medium">
                database migration scripts, but for your config files, npm
                packages and even source code
              </span>
              .
            </p>
          </div>
          <div className="action mt-6 flex">
            <ButtonLink
              href="/core-features/automate-updating-dependencies"
              variant="primary"
              size="default"
              title="Read more about affected command"
            >
              Read about migrations
            </ButtonLink>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="relative flex h-full w-full flex-col items-center gap-8"
        >
          <div className="w-[568px] max-w-full rounded-xl shadow-xl md:flex">
            <div className="coding flex w-full flex-col rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-normal text-slate-800 subpixel-antialiased shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <div className="flex items-center">
                <p>
                  <span className="text-base text-purple-600 dark:text-fuchsia-500">
                    →
                  </span>{' '}
                  <span className="mx-1 text-green-600 dark:text-green-400">
                    ~/workspace
                  </span>{' '}
                  <span>$</span>
                </p>
                <p className="typing mt-0.5 flex-1 pl-2">nx migrate latest</p>
              </div>
              <div className="mt-2 flex">
                <p className="typing flex-1 items-center pl-2">
                  Fetching meta data about packages.
                  <br />
                  It may take a few minutes.
                  <br />
                  Fetching nx@14.7.13
                  <br />
                  Fetching @nrwl/cypress@14.7.13
                  <br />
                  Fetching @nrwl/next@14.7.13
                  <br />
                  Fetching @nrwl/linter@14.7.13
                  <br />
                  Fetching @nrwl/workspace@14.7.13
                  <br />
                  Fetching @nrwl/jest@14.7.13
                  <br />
                  Fetching @nrwl/react@14.7.13
                  <br />
                  Fetching @nrwl/web@14.7.13
                </p>
              </div>
              <div className="mt-8 flex">
                <p className="typing flex-1 items-center pl-2">
                  <span className="bg-green-300 px-1 py-0.5 dark:bg-green-600">
                    NX
                  </span>
                  <span className="ml-2 text-green-500 dark:text-green-600">
                    The migrate command has run successfully.
                  </span>
                  <br />
                  <br />
                  - package.json has been updated.
                  <br />- migrations.json has been generated.
                </p>
              </div>
              <div className="mt-8 flex">
                <p className="typing flex-1 items-center pl-2">
                  <span className="mr-2 bg-yellow-300 px-1 py-0.5 dark:bg-yellow-600">
                    NX
                  </span>
                  Next steps:
                  <br />
                  <br />
                  - Make sure package.json changes make sense and then run
                  'yarn',
                  <br />
                  - Run 'yarn nx migrate --run-migrations'
                  <br />- To learn more go to
                  <a
                    href="https://nx.dev/core-features/automate-updating-dependencies"
                    className="ml-2 underline"
                  >
                    https://nx.dev/core-features/automate-updating-dependencies
                  </a>
                </p>
              </div>
            </div>
          </div>
          <div className="w-[568px] max-w-full self-start rounded-xl shadow-xl lg:absolute lg:left-1/2 lg:top-24">
            <div className="coding flex w-full flex-col rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-normal text-slate-800 subpixel-antialiased shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <div className="flex items-center">
                <p>
                  <span className="text-base text-purple-600 dark:text-fuchsia-500">
                    →
                  </span>{' '}
                  <span className="mx-1 text-green-600 dark:text-green-400">
                    ~/workspace
                  </span>{' '}
                  <span>$</span>
                </p>
                <p className="typing mt-0.5 flex-1 pl-2">
                  nx migrate --run-migrations
                </p>
              </div>
              <div className="mt-4 flex">
                <p className="typing flex-1 items-center pl-2">
                  <span className="mr-2 bg-yellow-300 px-1 py-0.5 dark:bg-yellow-600">
                    NX
                  </span>
                  Running 'yarn' to make sure necessary packages are installed
                </p>
              </div>
              <div className="mt-4 flex">
                <p className="typing flex-1 items-center pl-2">
                  <span className="mr-2 bg-yellow-300 px-1 py-0.5 dark:bg-yellow-600">
                    NX
                  </span>
                  Running migrations from 'migrations.json'
                </p>
              </div>
              <div className="mt-4 flex">
                <p className="typing flex-1 items-center pl-2">
                  <span className="bg-green-300 px-1 py-0.5 dark:bg-green-600">
                    NX
                  </span>
                  <span className="ml-2 text-green-500 dark:text-green-600">
                    This workspace is up to date!
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
