import Link from 'next/link';

export function MonorepoStyles(): JSX.Element {
  return (
    <article
      id="monorepo-styles"
      className="relative overflow-hidden bg-gray-50 pt-28 dark:bg-slate-800/40"
    >
      <div className="mx-auto max-w-7xl py-12 px-4 sm:grid sm:grid-cols-2 sm:gap-8 sm:px-6 lg:py-16 lg:px-8">
        <div>
          <header>
            <h1 className="text-lg font-semibold tracking-tight text-blue-500 dark:text-sky-500">
              <span className="sr-only">Nx supports </span>Different monorepo
              styles
            </h1>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
              Make Nx work for you
            </p>
          </header>
          <div className="mt-8 flex gap-16 font-normal">
            <p className="max-w-xl text-lg text-slate-700 dark:text-slate-400">
              Choose your style! Have a monorepo already?{' '}
              <Link href="/recipe/adding-to-monorepo">
                <a
                  title="Install VSCode's native extension for Nx"
                  className="font-medium text-blue-500 dark:text-sky-500"
                >
                  Add Nx on top!
                </a>
              </Link>{' '}
              <span className="font-medium">You control everything</span>, Nx
              makes things fast. Or focus on what matters and{' '}
              <span className="font-medium">let Nx do the heavy lifting</span>{' '}
              with its set of{' '}
              <Link href="/community#plugin-directory">
                <a
                  title="Install VSCode's native extension for Nx"
                  className="font-medium text-blue-500 dark:text-sky-500"
                >
                  powerful plugins
                </a>
              </Link>
              . Extend Nx by creating custom plugins that{' '}
              <span className="font-medium">work for your organization</span>,
              and you'll get the best possible DX you can have in a monorepo.
            </p>
          </div>
          <div className="action mt-6 flex">
            <Link href="/concepts/integrated-vs-package-based">
              <a
                title="Read more about affected command"
                className="rounded-full border border-transparent bg-blue-500 py-1 px-3 font-semibold text-white transition hover:bg-blue-600 hover:text-slate-50 focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:bg-sky-500 dark:hover:bg-sky-400"
              >
                Read about different monorepo styles
              </a>
            </Link>
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
                <p className="typing mt-0.5 flex-1 pl-2">
                  npx add-nx-to-monorepo
                </p>
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
                  🧑‍🔧 Analyzing the source code and creating configuration file
                </p>
              </div>{' '}
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
