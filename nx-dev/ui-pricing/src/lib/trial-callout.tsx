'use client';
import { ReactElement } from 'react';
import Image from 'next/image';
import { ButtonLink } from '@nx/nx-dev/ui-common';
import Link from 'next/link';
import { sendCustomEvent } from '@nx/nx-dev/feature-analytics';

export function TrialCallout({
  pageId,
}: {
  pageId: 'enterprise' | 'pricing';
}): ReactElement {
  return (
    <section id="start-trial" className="scroll-mt-24">
      <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="relative isolate overflow-hidden bg-white px-6 pt-16 shadow-2xl ring-1 ring-slate-200 sm:rounded-3xl sm:px-16 md:pt-24 lg:flex lg:gap-x-20 lg:px-24 lg:pt-0 dark:bg-slate-900 dark:ring-slate-800">
          <svg
            viewBox="0 0 1024 1024"
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 -z-10 h-[64rem] w-[64rem] -translate-y-1/2 [mask-image:radial-gradient(closest-side,white,transparent)] sm:left-full sm:-ml-80 lg:left-1/2 lg:ml-0 lg:-translate-x-1/2 lg:translate-y-0"
          >
            <circle
              r={512}
              cx={512}
              cy={512}
              fill="url(#1e3c1415-dh10-454c-aa3c-9a8019d0ap09d)"
              fillOpacity="0.7"
            />
            <defs>
              <radialGradient id="1e3c1415-dh10-454c-aa3c-9a8019d0ap09d">
                <stop stopColor="#9333ea" />
                <stop offset={1} stopColor="#3b82f6" />
              </radialGradient>
            </defs>
          </svg>
          <div className="mx-auto max-w-md text-center lg:mx-0 lg:flex-auto lg:py-32 lg:text-left">
            <h2 className="texxt-slate-950 text-balance text-3xl font-semibold tracking-tight sm:text-4xl dark:text-white">
              Start a Trial
            </h2>
            <p className="mt-6 text-pretty text-lg/8">
              Start with our Hobby Plan - free forever for teams of any size.
              Perfect for proof of concept testing with up to 50,000 credits per
              month.
            </p>
            <div className="mt-4 flex items-center justify-center gap-x-6 lg:justify-start">
              <ButtonLink
                href="https://cloud.nx.app"
                variant="primary"
                size="default"
                title="Start free trial"
                onClick={() =>
                  sendCustomEvent(
                    'start-trial-click',
                    'trial-callout-' + pageId,
                    'trial-callout'
                  )
                }
              >
                Start for free
              </ButtonLink>
            </div>
            <p className="mt-8 text-pretty text-base/8 leading-normal">
              Need a bit more? For larger teams we offer personalized support,{' '}
              <Link
                href="/contact-us/sales"
                title="Reach out to us"
                onClick={() =>
                  sendCustomEvent(
                    'contact-click',
                    'trial-callout-' + pageId,
                    'trial-callout'
                  )
                }
                className="font-semibold text-blue-500 dark:text-sky-500"
              >
                reach out to us and we'll help you get started with a trial
              </Link>{' '}
              that suites your team's needs.{' '}
            </p>
          </div>
          <div className="relative mt-16 h-80 lg:mt-8">
            <Image
              src="/images/cloud/nrwl-ocean.avif"
              alt="App screenshot: overview"
              width={2550}
              height={1622}
              loading="eager"
              priority
              className="absolute left-0 top-0 w-[57rem] max-w-none rounded-md bg-white/5 ring-1 ring-slate-950/10"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
