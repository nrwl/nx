import {
  BookOpenIcon,
  DocumentPlusIcon,
  ShareIcon,
} from '@heroicons/react/24/solid';
import Link from 'next/link';

export function CreateNxPlugin(): JSX.Element {
  return (
    <article
      id="create-nx-plugin"
      className="items-center p-4 lg:mx-auto lg:grid lg:max-w-7xl lg:grid-flow-col-dense lg:grid-cols-2 lg:gap-24 lg:px-8"
    >
      <header className="mx-auto max-w-xl lg:col-start-1 lg:mx-0 lg:max-w-none">
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
          <span className="sr-only">Nx </span>Community Plugins
        </h1>
        <p className="mt-8">
          Core Nx plugins are created and maintained by the Nx team at Nrwl and
          you can see all the available plugins when you run the{' '}
          <code className="break-normal rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            nx list
          </code>{' '}
          command in your workspace.
        </p>
        <p className="mt-8">
          The community plugins are created and maintained by members of the Nx
          community, will allow you to use the full power of the workspace while
          using different technologies!
        </p>

        <ul className="mx-4 mt-8 list-disc">
          <li className="mt-2">
            <Link href="/packages/nx-plugin#generating-a-plugin">
              <a className="hover:underline">Create your Nx Plugin</a>
            </Link>
          </li>
          <li className="mt-2">
            <Link href="/packages/nx-plugin#testing-your-plugin">
              <a className="hover:underline">Test your plugin</a>
            </Link>
          </li>
          <li className="mt-2">
            <Link href="/packages/nx-plugin#generating-a-plugin">
              <a className="hover:underline">Publish your Nx Plugin</a>
            </Link>
          </li>
        </ul>
      </header>
      <div className="lg:col-start-2">
        <div className="relative flex flex-col items-center justify-center lg:h-full">
          <iframe
            loading="lazy"
            className="max-w-screen-sm rounded-lg shadow-lg"
            width="100%"
            src="https://www.youtube.com/embed/XYO689PAhow"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          />
          <div className="mt-6 grid w-full grid-cols-1 items-center gap-4 lg:grid-cols-2">
            <div className="relative flex flex flex-col items-center items-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800">
              <div className="flex w-full px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href="/packages/nx-plugin#generating-a-plugin">
                    <a className="focus:outline-none">
                      <span className="absolute inset-0" aria-hidden="true" />
                      <p className="text-md mb-1 font-bold text-slate-600 dark:text-slate-300">
                        Create an Nx Plugin
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Follow this guide to generate an Nx plugin to fit your
                        needs
                      </p>
                    </a>
                  </Link>
                </div>
                <div className="flex-shrink-0">
                  <div className="rounded-full border border-slate-100 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                    <DocumentPlusIcon className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                  </div>
                </div>
              </div>
              <div className="mt-2 flex w-full items-center space-x-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-slate-400 dark:border-slate-700 dark:bg-slate-800">
                <BookOpenIcon className="h-4 w-4" />
                <p className="text-xs font-bold">packages/nx-plugin</p>
              </div>
            </div>
            <div className="relative flex flex flex-col items-center items-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800">
              <div className="flex w-full px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href="/packages/nx-plugin#publishing-your-nx-plugin">
                    <a className="focus:outline-none">
                      <span className="absolute inset-0" aria-hidden="true" />
                      <p className="text-md mb-1 font-bold text-slate-600 dark:text-slate-300">
                        Publish an Nx Plugin
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Follow this guide to publish your new and shiny Nx
                        plugin
                      </p>
                    </a>
                  </Link>
                </div>
                <div className="flex-shrink-0">
                  <div className="rounded-full border border-slate-100 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                    <ShareIcon className="h-6 w-6 text-slate-600 dark:text-slate-300" />
                  </div>
                </div>
              </div>
              <div className="mt-2 flex w-full items-center space-x-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-slate-400 dark:border-slate-700 dark:bg-slate-800">
                <BookOpenIcon className="h-4 w-4" />
                <p className="text-xs font-bold">packages/nx-plugin</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
