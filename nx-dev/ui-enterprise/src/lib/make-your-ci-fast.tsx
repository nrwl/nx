import { ReactElement } from 'react';
import { SectionHeading } from '@nx/nx-dev/ui-common';

export function MakeYourCiFast(): ReactElement {
  return (
    <section className="make-your-ci-fast-section">
      <div className="mx-auto max-w-2xl px-6 lg:max-w-7xl lg:px-8">
        <SectionHeading id="make-your-ci-fast" as="h1" variant="title">
          Make your CI fast,{' '}
          <span className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
            really fast
          </span>
        </SectionHeading>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-16 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(theme(borderRadius.lg)+1px)] bg-white shadow ring-1 ring-black/5 lg:rounded-tl-[calc(2rem+1px)] dark:bg-slate-950 dark:ring-white/10">
              <img
                alt="Nx Replay: remote caching"
                src="/images/enterprise/nx-replay.avif"
                className="h-80 object-cover object-left"
              />
              <div className="relative p-10 pt-4">
                <div className="absolute -top-10 left-10">
                  <span className="inline-flex items-center rounded-md bg-slate-400/10 px-2 py-1 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-400/20">
                    Nx Replay
                  </span>
                </div>
                <h3 className="text-lg font-medium tracking-tight text-slate-950 dark:text-white">
                  Never build the same code twice
                </h3>
                <p className="mt-2 max-w-lg text-sm/6">
                  Remote caching ensures that tasks are never rebuilt twice,
                  significantly reducing build times and resource usage. Share
                  cached results across your team and CI pipelines.
                </p>
              </div>
            </div>
          </div>
          <div className="relative lg:col-span-2">
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(theme(borderRadius.lg)+1px)] bg-white shadow ring-1 ring-black/5 dark:bg-slate-950 dark:ring-white/10">
              <img
                alt="Nx flaky task detection & rerun"
                src="/images/enterprise/nx-flaky-tasks-detection.avif"
                className="h-80 object-cover"
              />
              <div className="relative p-10 pt-4">
                <div className="absolute -top-10 left-10">
                  <span className="inline-flex items-center rounded-md bg-slate-400/10 px-2 py-1 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-400/20">
                    Flaky task retries
                  </span>
                </div>
                <h3 className="text-lg font-medium tracking-tight text-slate-950 dark:text-white">
                  One less thing to debug
                </h3>
                <p className="mt-2 max-w-lg text-sm/6">
                  Automatically detect and re-run flaky tasks, enhancing the
                  reliability of your CI processes and minimizing time spent
                  debugging.
                </p>
              </div>
            </div>
          </div>
          <div className="relative lg:col-span-2">
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(theme(borderRadius.lg)+1px)] bg-white shadow ring-1 ring-black/5 lg:rounded-tr-[calc(2rem+1px)] dark:bg-slate-950 dark:ring-white/10">
              <img
                alt="Nx Atomizer: split large tasks & E2E in chunks"
                src="/images/enterprise/nx-atomizer.avif"
                className="h-80 object-cover object-left"
              />
              <div className="relative p-10 pt-4">
                <div className="absolute -top-10 left-10">
                  <span className="inline-flex items-center rounded-md bg-slate-400/10 px-2 py-1 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-400/20">
                    Atomizer
                  </span>
                </div>
                <h3 className="text-lg font-medium tracking-tight text-slate-950 dark:text-white">
                  Break tasks down, to speed tests up
                </h3>
                <p className="mt-2 max-w-lg text-sm/6">
                  <span className="font-semibold">Atomizer</span> automatically
                  splits large e2e tests into smaller, atomized tasks, enabling
                  lightning fast testing. Parallelize your tests to reduce
                  bottlenecks and keep your pipelines fast.
                </p>
              </div>
            </div>
          </div>
          <div className="relative lg:col-span-3">
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(theme(borderRadius.lg)+1px)] bg-white shadow ring-1 ring-black/5 lg:rounded-bl-[calc(2rem+1px)] dark:bg-slate-950 dark:ring-white/10">
              <img
                alt="Nx Agents: simple & fast task distribution"
                src="/images/enterprise/nx-agents.avif"
                className="h-80 object-cover object-left"
              />
              <div className="relative p-10 pt-4">
                <div className="absolute -top-10 left-10">
                  <span className="inline-flex items-center rounded-md bg-slate-400/10 px-2 py-1 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-400/20">
                    Nx Agents
                  </span>
                </div>
                <h3 className="text-lg font-medium tracking-tight text-slate-950 dark:text-white">
                  Machines, make it fast!
                </h3>
                <p className="mt-2 max-w-lg text-sm/6">
                  <span className="font-semibold">Nx Agents</span> intelligently
                  distribute tasks across multiple machines, significantly
                  reducing build times. Dynamically allocate agents based on PR
                  size to balance speed and cost.
                </p>
              </div>
            </div>
          </div>
          <div className="relative lg:col-span-3">
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(theme(borderRadius.lg)+1px)] bg-white shadow ring-1 ring-black/5 lg:rounded-br-[calc(2rem+1px)] dark:bg-slate-950 dark:ring-white/10">
              <img
                alt="Partner with the Nx Team for guidances"
                src="/images/enterprise/nx-partnership.avif"
                className="h-80 object-cover object-left lg:object-right"
              />
              <div className="relative p-10 pt-4">
                <div className="absolute -top-10 left-10">
                  <span className="inline-flex items-center rounded-md bg-slate-400/10 px-2 py-1 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-400/20">
                    Partnership
                  </span>
                </div>
                <h3 className="text-lg font-medium tracking-tight text-slate-950 dark:text-white">
                  Always thinking a step ahead for you
                </h3>
                <p className="mt-2 max-w-lg text-sm/6">
                  With Nx, you receive expert guidance from day one, ensuring
                  your setup is optimized for maximum efficiency. Whether you're
                  starting fresh, migrating, or scaling your developer platform,
                  we'll work with you to tailor the perfect solution for your
                  team.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
