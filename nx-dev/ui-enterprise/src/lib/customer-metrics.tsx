import { ReactElement } from 'react';
import { HetznerCloudIcon } from '@nx/nx-dev-ui-icons';
import { SectionHeading } from '@nx/nx-dev-ui-common';
import Link from 'next/link';
import { sendCustomEvent } from '@nx/nx-dev-feature-analytics';
import { PlayIcon } from '@heroicons/react/24/outline';

export function CustomerMetrics(): ReactElement {
  return (
    <section className="border-b border-t border-slate-200 bg-slate-50 py-24 sm:py-32 dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-none">
          <div className="mt-6 flex flex-col-reverse gap-x-8 gap-y-20 lg:flex-row lg:items-center">
            <div className="lg:w-full lg:max-w-2xl lg:flex-auto">
              <a
                href="#hetzner-cloud-testimonial"
                onClick={() => {
                  sendCustomEvent(
                    'hetzner-quote-click',
                    'enterprise-customer-metrics',
                    'enterprise'
                  );
                }}
                className="group relative block rounded-2xl"
              >
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/60 opacity-0 backdrop-blur-sm transition duration-300 group-hover:opacity-100 dark:bg-slate-950/60">
                  <div className="flex items-center gap-2 text-lg font-semibold text-slate-950 drop-shadow dark:text-white">
                    <PlayIcon className="size-8" />
                    Watch the interview
                  </div>
                </div>
                <figure className="relative rounded-2xl bg-white shadow-lg ring-1 ring-slate-900/5 dark:bg-slate-800">
                  <blockquote className="p-6 text-lg font-semibold tracking-tight text-black dark:text-white">
                    <p>
                      Engineers will run a test command and expect it to run for
                      20 mins, they start it and see it finishes in a few
                      seconds, then they ask "Did I start it wrong? Why is it so
                      fast?"
                    </p>
                  </blockquote>
                  <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-4 border-t border-slate-900/10 px-6 py-4 sm:flex-nowrap dark:border-slate-100/10">
                    <img
                      alt="pavlo grosse"
                      src="https://avatars.githubusercontent.com/u/2219064?v=4"
                      className="size-10 flex-none rounded-full bg-slate-50"
                    />
                    <div className="flex-auto">
                      <div className="font-semibold">Pavlo Grosse</div>
                      <div className="text-slate-600 dark:text-slate-500">
                        Senior Software Engineer, Hetzner Cloud
                      </div>
                    </div>
                    <HetznerCloudIcon
                      aria-hidden="true"
                      className="mx-auto size-10 flex-none bg-white text-[#D50C2D]"
                    />
                  </figcaption>
                </figure>
              </a>
              <SectionHeading
                as="p"
                variant="subtitle"
                className="mt-8 text-center italic"
              >
                Want to see it in action?{' '}
                <Link
                  href="/contact/sales"
                  title="Request Nx Enterprise demo"
                  prefetch={false}
                  onClick={() =>
                    sendCustomEvent(
                      'request-trial-click',
                      'enterprise-customer-metrics',
                      'enterprise'
                    )
                  }
                  className="font-semibold underline"
                >
                  Request a demo now <span aria-hidden="true">→</span>
                </Link>
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
