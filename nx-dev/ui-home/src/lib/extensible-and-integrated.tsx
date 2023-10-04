import { Tab } from '@headlessui/react';
import { Button, SectionHeading } from '@nx/nx-dev/ui-common';
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
          <SectionHeading
            as="h1"
            variant="title"
            id="extensible-and-integrated"
          >
            Integrated developer experience
          </SectionHeading>
          <SectionHeading
            as="p"
            variant="display"
            id="nx-is-fast"
            className="mt-4"
          >
            Everything is just a click away
          </SectionHeading>
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
              href="/core-features/integrate-with-editors"
              className="font-medium text-blue-500 dark:text-sky-500"
              title="Install JetBrains' native plugin for Nx"
            >
              JetBrains
            </Link>{' '}
            and{' '}
            <Link
              href="/core-features/integrate-with-editors#neovim"
              className="font-medium text-blue-500 dark:text-sky-500"
            >
              Neovim
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
            <div className="flex justify-between space-x-4 md:justify-start">
              {tabs.map((tab) => (
                <Tab as={Fragment} key={'tab-' + tab.title}>
                  {({ selected }) => (
                    <Button
                      variant={selected ? 'primary' : 'secondary'}
                      size="small"
                    >
                      {tab.title}
                    </Button>
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
