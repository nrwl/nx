import { ReactElement } from 'react';
import { PayfitIcon } from '@nx/nx-dev/ui-icons';
import { SectionHeading } from '@nx/nx-dev/ui-common';

export function CustomerMetrics(): ReactElement {
  return (
    <section id="customer-metrics" className="scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-none">
          <div className="mt-6 flex flex-col-reverse gap-x-8 gap-y-20 lg:flex-row lg:items-center">
            <div className="lg:w-full lg:max-w-2xl lg:flex-auto">
              <div className="group relative block rounded-2xl">
                <figure className="relative rounded-2xl bg-white shadow-lg ring-1 ring-slate-900/5 dark:bg-slate-800">
                  <blockquote className="p-6 text-lg font-semibold tracking-tight text-black dark:text-white">
                    <p>
                      The number of hours we spent trying to manage CI before,
                      trying to load balance in CircleCI, the number of agents
                      that we run ourselves by hand and try to distribute
                      ourselves manually - it was painful, we'd spend hours and
                      days trying to do that. With Nx Cloud we don't need to
                      think about that, here is my task, deal with it and make
                      it fast."
                    </p>
                  </blockquote>
                  <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-4 border-t border-slate-900/10 px-6 py-4 sm:flex-nowrap dark:border-slate-100/10">
                    <img
                      alt="Nicolas Beaussart image"
                      src="https://avatars.githubusercontent.com/u/7281023?v=4"
                      className="size-10 rounded-full bg-slate-50"
                    />
                    <div className="flex-auto">
                      <div className="font-semibold">Nicolas Beaussart</div>
                      <div className="text-slate-600 dark:text-slate-500">
                        Staff Platform Engineer, Payfit
                      </div>
                    </div>
                    <PayfitIcon
                      aria-hidden="true"
                      className="mx-auto size-10 flex-none rounded-full bg-white text-[#0F6FDE]"
                    />
                  </figcaption>
                </figure>
              </div>
              <SectionHeading
                as="p"
                variant="subtitle"
                className="mt-8 text-center italic"
              >
                Want to get started?{' '}
                <a
                  href="https://cloud.nx.app/get-started"
                  title="Get started"
                  className="font-semibold underline"
                >
                  Connect your repository now <span aria-hidden="true">→</span>
                </a>
              </SectionHeading>
            </div>
            <div className="lg:flex lg:flex-auto lg:justify-center">
              <dl className="flex flex-col justify-center gap-8 sm:flex-row lg:flex-col xl:w-80">
                <div className="flex flex-col-reverse gap-y-1 border-slate-200 pl-4 text-center sm:border-l sm:text-left dark:border-slate-800">
                  <dt className="text-base/7">faster CI</dt>
                  <dd className="[text-shadow:1px 1px 0 white;] te text-5xl font-semibold tracking-tight text-black dark:text-white">
                    70%
                  </dd>
                </div>
                <div className="flex flex-col-reverse gap-y-1 border-slate-200 pl-4 text-center sm:border-l sm:text-left dark:border-slate-800">
                  <dt className="text-base/7">less compute used</dt>
                  <dd className="text-5xl font-semibold tracking-tight text-black dark:text-white">
                    60%
                  </dd>
                </div>
                <div className="flex flex-col-reverse gap-y-1 border-slate-200 pl-4 text-center sm:border-l sm:text-left dark:border-slate-800">
                  <dt className="text-base/7">reduction in infra costs</dt>
                  <dd className="text-5xl font-semibold tracking-tight text-black dark:text-white">
                    75%
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
