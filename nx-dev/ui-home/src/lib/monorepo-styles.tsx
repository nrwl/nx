import { ButtonLink, SectionHeading } from '@nx/nx-dev/ui-common';
import Link from 'next/link';

export function MonorepoStyles(): JSX.Element {
  return (
    <article
      id="monorepo-styles"
      className="relative overflow-hidden bg-slate-50 pt-28 dark:bg-slate-800/40"
    >
      <div className="mx-auto max-w-7xl py-12 px-4 sm:grid sm:grid-cols-2 sm:gap-8 sm:px-6 lg:py-16 lg:px-8">
        <div>
          <header>
            <SectionHeading as="h1" variant="title" id="monorepo-styles">
              <span className="sr-only">Nx supports </span>Different monorepo
              styles
            </SectionHeading>
            <SectionHeading
              as="p"
              variant="display"
              id="nx-is-fast"
              className="mt-4"
            >
              Make Nx work for you
            </SectionHeading>
          </header>
          <div className="mt-8 flex gap-16 font-normal">
            <p className="max-w-xl text-lg text-slate-700 dark:text-slate-400">
              Choose your style! Have a monorepo already?{' '}
              <Link
                href="/recipes/adopting-nx/adding-to-monorepo"
                title="Install VSCode's native extension for Nx"
                className="font-medium text-blue-500 dark:text-sky-500"
              >
                Add Nx on top!
              </Link>{' '}
              <span className="font-medium">You control everything</span>, Nx
              makes things fast. Or focus on what matters and{' '}
              <span className="font-medium">let Nx do the heavy lifting</span>{' '}
              with its set of{' '}
              <Link
                href="/plugins"
                title="Install VSCode's native extension for Nx"
                className="font-medium text-blue-500 dark:text-sky-500"
              >
                powerful plugins
              </Link>
              . Extend Nx by creating custom plugins that{' '}
              <span className="font-medium">work for your organization</span>,
              and you'll get the best possible DX you can have in a monorepo.
            </p>
          </div>
          <div className="action mt-6 flex">
            <ButtonLink
              variant="primary"
              size="default"
              href="/concepts/integrated-vs-package-based"
              title="Read more about affected command"
            >
              Read about different monorepo styles
            </ButtonLink>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="relative flex h-full w-full flex-col items-center gap-8 py-8"
        >
          <div className="w-[568px] max-w-full rounded-xl shadow-xl">
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
                  npx create-nx-workspace
                </p>
              </div>
              <div className="mt-4 flex">
                <p className="typing flex-1 items-center pl-2">
                  <span className="mr-2 bg-yellow-300 px-1 py-0.5 dark:bg-yellow-600">
                    NX
                  </span>
                  ⚙️ Creating Nx workspace
                </p>
              </div>
              <div className="mt-4 flex">
                <p className="typing flex-1 items-center pl-2">
                  <span className="mr-2 bg-yellow-300 px-1 py-0.5 dark:bg-yellow-600">
                    NX
                  </span>
                  📦 Installing dependencies
                </p>
              </div>
              <div className="mt-4 flex">
                <p className="typing flex-1 items-center pl-2">
                  <span className="mr-2 bg-green-300 px-1 py-0.5 dark:bg-green-600">
                    NX
                  </span>
                  Your Nx workspace is ready!
                </p>
              </div>
            </div>
          </div>
          <div className="w-[568px] max-w-full rounded-xl shadow-xl">
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
                <p className="typing mt-0.5 flex-1 pl-2">npx nx@latest init</p>
              </div>
              <div className="mt-4 flex">
                <p className="typing flex-1 items-center pl-2">
                  <span className="mr-2 bg-pink-300 px-1 py-0.5 dark:bg-fuchsia-600">
                    NX
                  </span>
                  🐳 Nx initialization
                </p>
              </div>
              <div className="mt-4 flex">
                <p className="typing flex-1 items-center pl-2">
                  <span className="mr-2 bg-pink-300 px-1 py-0.5 dark:bg-fuchsia-600">
                    NX
                  </span>
                  📦 Installing dependencies
                </p>
              </div>
              <div className="mt-4 flex">
                <p className="typing flex-1 items-center pl-2">
                  <span className="mr-2 bg-green-300 px-1 py-0.5 dark:bg-green-600">
                    NX
                  </span>
                  🎉 Done!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
