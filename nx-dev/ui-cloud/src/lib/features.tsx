import { ReactElement } from 'react';
import { SectionHeading } from '@nx/nx-dev-ui-common';

export function Features(): ReactElement {
  return (
    <section
      id="features"
      className="scroll-mt-24 border-b border-t border-slate-200 bg-slate-50 py-24 sm:py-32 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading as="h2" variant="title" id="features-title">
            Features
          </SectionHeading>
          {/*<SectionHeading as="p" variant="subtitle" className="mt-8">*/}
          {/*  Nx Cloud compresses the entire validation process. The result is a*/}
          {/*  short, predictable, and fully automated path to a green PR.*/}
          {/*</SectionHeading>*/}
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-4 sm:mt-16 md:grid-cols-2">
          <div className="relative">
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(theme(borderRadius.lg)+1px)] bg-white shadow ring-1 ring-black/5 lg:rounded-tl-[calc(2rem+1px)] dark:bg-slate-950 dark:ring-white/10">
              <img
                alt="Nx Replay: remote caching"
                src="/images/enterprise/nx-replay.avif"
                className="h-80 object-cover object-center"
              />
              <div className="relative p-10 pt-4">
                <h3 className="text-lg font-medium tracking-tight text-slate-950 dark:text-white">
                  Secure Remote Cache
                </h3>
                <p className="mt-2 max-w-lg text-sm/6">
                  It ensures that tasks are never rebuilt twice, significantly
                  reducing build times and resource usage. Share cached results
                  across your team and CI pipelines.
                </p>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(theme(borderRadius.lg)+1px)] bg-white shadow ring-1 ring-black/5 lg:rounded-tr-[calc(2rem+1px)] dark:bg-slate-950 dark:ring-white/10">
              <img
                alt="Nx flaky task detection & rerun"
                src="/images/enterprise/nx-flaky-tasks-detection.avif"
                className="h-80 object-cover"
              />
              <div className="relative p-10 pt-4">
                <h3 className="text-lg font-medium tracking-tight text-slate-950 dark:text-white">
                  Self-Healing CI
                </h3>
                <p className="mt-2 max-w-lg text-sm/6">
                  It automatically detects and fixes flaky tests and issues
                  without developer intervention enhancing the reliability of
                  your CI processes and minimizing time spent debugging.
                </p>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(theme(borderRadius.lg)+1px)] bg-white shadow ring-1 ring-black/5 dark:bg-slate-950 dark:ring-white/10">
              <img
                alt="Nx Atomizer: split large tasks & E2E in chunks"
                src="/images/enterprise/nx-atomizer.avif"
                className="h-80 object-cover object-center"
              />
              <div className="relative p-10 pt-4">
                <h3 className="text-lg font-medium tracking-tight text-slate-950 dark:text-white">
                  E2E Test Splitting
                </h3>
                <p className="mt-2 max-w-lg text-sm/6">
                  It automatically splits large e2e tests into smaller, atomized
                  tasks, enabling lightning fast testing. Parallelize your tests
                  to reduce bottlenecks and keep your pipelines fast.
                </p>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(theme(borderRadius.lg)+1px)] bg-white shadow ring-1 ring-black/5 dark:bg-slate-950 dark:ring-white/10">
              <img
                alt="Nx Agents: simple & fast task distribution"
                src="/images/enterprise/nx-agents.avif"
                className="h-80 object-cover object-center"
              />
              <div className="relative p-10 pt-4">
                <h3 className="text-lg font-medium tracking-tight text-slate-950 dark:text-white">
                  Distributed Task Execution
                </h3>
                <p className="mt-2 max-w-lg text-sm/6">
                  It intelligently distributes tasks across multiple machines,
                  significantly reducing build times. Dynamically allocate
                  agents based on PR size to balance speed and cost.
                </p>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(theme(borderRadius.lg)+1px)]  bg-white shadow ring-1 ring-black/5 lg:rounded-bl-[calc(2rem+1px)] dark:bg-slate-800 dark:ring-white/10">
              <img
                alt="Nx Agents: simple & fast task distribution"
                src="/images/enterprise/visibility.avif"
                className="h-80 object-cover object-center"
              />
              <div className="relative p-10 pt-4">
                <div className="absolute -top-10 left-10">
                  <span className="inline-flex items-center rounded-md bg-slate-400/10 px-2 py-1 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-400/20">
                    Enterprise
                  </span>
                </div>
                <h3 className="text-lg font-medium tracking-tight text-slate-950 dark:text-white">
                  See Dependencies Across Teams & Repositories
                </h3>
                <p className="mt-2 max-w-lg text-sm/6">
                  In an organization with hundreds of repos it can be hard to
                  understand the relationships between different parts of your
                  ever-growing codebases. With the Workspace Graph, see
                  dependencies across all your repos to understand which
                  projects and teams are affected by changes in a single repo.
                </p>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(theme(borderRadius.lg)+1px)] bg-white shadow ring-1 ring-black/5 lg:rounded-br-[calc(2rem+1px)] dark:bg-slate-800 dark:ring-white/10">
              <img
                alt="Nx Atomizer: split large tasks & E2E in chunks"
                src="/images/enterprise/conformance.avif"
                className="h-80 object-cover object-center"
              />
              <div className="relative p-10 pt-4">
                <div className="absolute -top-10 left-10">
                  <span className="inline-flex items-center rounded-md bg-slate-400/10 px-2 py-1 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-400/20">
                    Enterprise
                  </span>
                </div>
                <h3 className="text-lg font-medium tracking-tight text-slate-950 dark:text-white">
                  Streamline Onboarding & Governance
                </h3>
                <p className="mt-2 max-w-lg text-sm/6">
                  Platform teams can easily publish and enforce coding standards
                  across an entire organization. Write and publish rules,
                  refactorings, and generators, then quickly deploy them across
                  all repos without involving individual teams. Ensure security
                  vulnerabilities are always addressed and third-party
                  dependencies stay up to date.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
