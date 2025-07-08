import { ReactElement } from 'react';
import { SectionHeading, Strong } from '@nx/nx-dev/ui-common';

export function TimeToGreen(): ReactElement {
  return (
    <section id="time-to-green" className="scroll-mt-24">
      <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
        <SectionHeading as="h2" variant="title" id="time-to-green-title">
          Nx Cloud Cuts{' '}
          <span className="rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
            Time To Green
          </span>
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-8">
          Nx Cloud compresses the entire validation process. Its remote cache
          and automatic task distribution speed up CI, while its self-healing
          system automatically reruns flaky tests and fixes code issues. <br />
          <Strong>
            The result is a short, predictable, and fully automated path to a
            green PR.
          </Strong>
        </SectionHeading>
      </div>
      <div className="mx-auto mt-12 max-w-5xl px-6 lg:px-8">
        <h3 className="text-xl font-semibold">Average Time To Green</h3>

        <div className="mt-2">
          <div className="relative grid grid-cols-1 rounded-lg text-xs font-medium shadow ring-1 ring-black/5 sm:h-12 sm:grid-cols-12 dark:bg-slate-950 dark:ring-white/10">
            <div className="flex h-12 items-center justify-center rounded-t-lg bg-blue-600 text-white sm:col-span-2 sm:h-auto sm:rounded-l-lg sm:rounded-r-none">
              <span className="px-2">Write Code</span>
            </div>
            <div className="relative flex h-12 items-center justify-center bg-red-600 text-white  sm:col-span-2 sm:h-auto">
              <span className="px-2">Run CI (Flaky Test Failure)</span>
            </div>
            <div className="flex h-12 items-center justify-center bg-red-800 text-white sm:col-span-3 sm:h-auto">
              <span className="px-2">Switch Focus</span>
            </div>
            <div className="relative flex h-12 items-center justify-center bg-red-600 text-white sm:col-span-2 sm:h-auto">
              <span className="px-2">Re-Run CI (Code Error)</span>
            </div>
            <div className="flex h-12 items-center justify-center bg-red-700 text-white sm:col-span-1 sm:h-auto">
              <span className="px-2">Fix Code</span>
            </div>
            <div className="flex h-12 items-center justify-center rounded-b-lg bg-green-600 text-white sm:col-span-2 sm:h-auto sm:rounded-b-none sm:rounded-r-lg">
              <span className="px-2">Re-Run CI</span>
            </div>
          </div>
        </div>
        <div className="mt-6">
          <h3 className="text-xl font-semibold">Time To Green with Nx Cloud</h3>
          <div className="mt-2 grid grid-cols-1 sm:h-12 sm:grid-cols-12">
            <div className="col-span-4 grid grid-cols-1 sm:grid-cols-6">
              <div className="grid grid-cols-1 rounded-lg text-xs font-medium shadow ring-1 ring-black/5 sm:col-span-5 sm:grid-cols-10 dark:bg-slate-950 dark:ring-white/10">
                <div className="flex h-12 items-center justify-center rounded-t-lg bg-blue-600 text-white sm:col-span-6 sm:h-auto sm:rounded-l-lg sm:rounded-r-none">
                  <span className="px-2">Write Code</span>
                </div>

                <div className="flex h-12 items-center justify-center rounded-b-lg bg-green-600 text-white sm:col-span-4 sm:h-auto sm:rounded-b-none sm:rounded-r-lg">
                  <span className="px-2">CI + Self-Healing</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
