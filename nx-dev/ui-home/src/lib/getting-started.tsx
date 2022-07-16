import Link from 'next/link';
import React from 'react';

export function GettingStarted(): JSX.Element {
  return (
    <article
      id="getting-started"
      className="border-t border-b border-slate-200 bg-gradient-to-r from-cyan-500 to-blue-500 shadow-inner dark:border-slate-700"
    >
      <div className="mx-auto max-w-7xl py-12 px-4 sm:px-6 lg:flex lg:items-center lg:justify-between lg:py-24 lg:px-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            <span className="block">Ready to dive in?</span>
            <span className="block text-white">
              Start your monorepo now with Nx.
            </span>
          </h2>
        </div>
        <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
          <div className="inline-flex rounded-md">
            <Link href="/getting-started/intro">
              <a
                title="Start using Nx by creating a workspace"
                className="w-full flex-none rounded-full border border-transparent bg-slate-100 py-3 px-6 text-lg font-semibold leading-6 transition hover:bg-slate-200 focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 sm:w-auto"
              >
                Get started
              </a>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
