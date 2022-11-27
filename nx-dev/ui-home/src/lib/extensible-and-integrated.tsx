import { Tab } from '@headlessui/react';
import cx from 'classnames';
import { AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Fragment } from 'react';
import { tabs } from './extensible-and-integrated/tabs';

export function ExtensibleAndIntegrated(): JSX.Element {
  return (
    <article
      id="extensible-and-integrated"
      className="overflow-hidden bg-slate-50 pt-28 dark:bg-slate-800/40"
    >
      <div className="mx-auto max-w-7xl py-12 px-4 sm:px-6 lg:py-16 lg:px-8">
        <header className="max-w-2xl">
          <h1 className="text-lg font-semibold tracking-tight text-blue-500 dark:text-sky-500">
            Integrated developer experience
          </h1>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
            Everything is just a click away
          </p>
        </header>
        <div className="mt-8 flex flex-col gap-16 font-normal md:flex-row">
          <p className="max-w-xl text-lg text-slate-700 dark:text-slate-400">
            No need to browse the docs to find the right commands to run.{' '}
            <span className="font-medium">Stay in the flow!</span> Augment your
            editor with Nx Console, a dedicated extension available for{' '}
            <Link
              href="/core-features/integrate-with-editors"
              title="Install VSCode's native extension for Nx"
              className="font-medium text-blue-500 dark:text-sky-500"
            >
              VSCode
            </Link>{' '}
            ,{' '}
            <Link
              href="/core-features/integrate-with-editors#neovim"
              className="font-medium text-blue-500 dark:text-sky-500"
            >
              Neovim
            </Link>{' '}
            and{' '}
            <Link
              href="/core-features/integrate-with-editors#webstorm"
              className="font-medium text-blue-500 dark:text-sky-500"
            >
              Webstorm
            </Link>
            . Generating a new library, running e2e tests, building your app -
            everything just a click away.
          </p>
          <p className="max-w-xl text-lg text-slate-700 dark:text-slate-400">
            Debug and understand your workspace with the built-in{' '}
            <code>nx graph</code> capabilities! Also,{' '}
            <span className="font-medium">
              give yourself a treat by enabling the Nx Cloud GitHub integration
            </span>
            . Most CI interfaces are a struggle to work with and they are not
            made for monorepos. The{' '}
            <Link
              href="https://nx.app/?utm_source=nx.dev"
              title="Nx Cloud: Distributed Task execution & Caching"
              className="font-medium text-blue-500 dark:text-sky-500"
              target="_blank"
              rel="noreferrer"
            >
              Nx Cloud
            </Link>{' '}
            integration takes care of that, presenting what matters most in an
            awesome visual way.
          </p>
        </div>
      </div>
      <div className="relative mx-auto max-w-7xl px-4 pt-6 pb-12 sm:px-6 lg:px-8 lg:pb-4 lg:pt-6">
        <Tab.Group>
          <Tab.List>
            <div className="flex justify-between md:justify-start">
              {tabs.map((tab) => (
                <Tab as={Fragment} key={'tab-' + tab.title}>
                  {({ selected }) => (
                    <button
                      className={cx(
                        'rounded-md px-3 py-2 text-sm font-medium',
                        selected
                          ? 'bg-blue-500 text-white dark:bg-sky-500'
                          : 'text-slate-700 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-300'
                      )}
                    >
                      {tab.title}
                    </button>
                  )}
                </Tab>
              ))}
            </div>
          </Tab.List>
          <Tab.Panels>
            <AnimatePresence>
              {tabs.map((tab) => (
                <Tab.Panel key={'panel-' + tab.title}>{tab.panel}</Tab.Panel>
              ))}
            </AnimatePresence>
          </Tab.Panels>
        </Tab.Group>
      </div>
    </article>
  );
}
