import { ButtonLink, SectionHeading } from '@nx/nx-dev/ui-common';
import { type ReactElement } from 'react';
import { sendCustomEvent } from '@nx/nx-dev/feature-analytics';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

export function Hero(): ReactElement {
  return (
    <section className="relative isolate overflow-hidden">
      <svg
        focusable="false"
        aria-hidden="true"
        role="presentation"
        className="absolute inset-0 -z-10 size-full stroke-slate-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)] dark:stroke-slate-800"
      >
        <defs>
          <pattern
            x="50%"
            y={-1}
            id="0787a7c5-978c-4f66-83c7-11c213f99cb7"
            width={200}
            height={200}
            patternUnits="userSpaceOnUse"
          >
            <path d="M.5 200V.5H200" fill="none" />
          </pattern>
        </defs>
        <rect
          fill="url(#0787a7c5-978c-4f66-83c7-11c213f99cb7)"
          width="100%"
          height="100%"
          strokeWidth={0}
        />
      </svg>
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-32 lg:flex lg:px-8 lg:pt-56">
        <div className="mx-auto max-w-2xl lg:mx-0 lg:-mt-12 lg:shrink-0">
          {/*<p>*/}
          {/*  <a*/}
          {/*    href="https://bit.ly/40t8IMN"*/}
          {/*    title="See live event in details"*/}
          {/*    className="group/event-link inline-flex space-x-6"*/}
          {/*  >*/}
          {/*    <span className="rounded-full bg-blue-600/10 px-3 py-1 text-sm/6 font-semibold text-blue-600 ring-1 ring-inset ring-blue-600/10 dark:bg-cyan-600/10 dark:text-cyan-600 dark:ring-cyan-600/10">*/}
          {/*      Live event*/}
          {/*    </span>*/}
          {/*    <span className="inline-flex items-center space-x-2 text-sm/6 font-medium">*/}
          {/*      <span>Webinar + live Q&A on January 22nd</span>*/}
          {/*      <ChevronRightIcon*/}
          {/*        aria-hidden="true"*/}
          {/*        className="size-5 transform transition-all group-hover/event-link:translate-x-1"*/}
          {/*      />*/}
          {/*    </span>*/}
          {/*  </a>*/}
          {/*</p>*/}
          <SectionHeading
            id="get-speed-and-scale"
            as="h1"
            variant="display"
            className="mt-8 text-pretty tracking-tight"
          >
            Solving the Performance Paradox,{' '}
            <span className="rounded-lg bg-gradient-to-r from-pink-500 to-fuchsia-500 bg-clip-text text-transparent">
              get speed and scale
            </span>
          </SectionHeading>
          <SectionHeading
            as="p"
            variant="subtitle"
            className="mx-auto mt-6 max-w-3xl lg:pr-20"
          >
            Accelerate your organization's journey to tighter collaboration,
            better developer experience, and speed…lots of speed.
          </SectionHeading>
          <div className="mt-8 flex items-center gap-x-3">
            <ButtonLink
              href="/enterprise/trial"
              title="Request a free trial"
              variant="primary"
              size="default"
              onClick={() =>
                sendCustomEvent(
                  'request-trial-click',
                  'enterprise-hero',
                  'enterprise'
                )
              }
            >
              Request a free trial
            </ButtonLink>

            <ButtonLink
              href="/contact/sales"
              title="Talk to the team"
              variant="secondary"
              size="default"
              onClick={() =>
                sendCustomEvent(
                  'contact-sales-click',
                  'enterprise-hero',
                  'enterprise'
                )
              }
            >
              Contact sales
            </ButtonLink>
          </div>
        </div>
        <div className="mx-auto mt-16 flex max-w-2xl sm:mt-24 lg:ml-10 lg:mr-0 lg:mt-8 lg:max-w-none lg:flex-none xl:ml-32">
          <div className="max-w-3xl flex-none sm:max-w-5xl lg:max-w-none">
            <div className="-m-2 rounded-xl bg-slate-900/5 p-2 ring-1 ring-inset ring-slate-900/10 lg:-m-4 lg:rounded-2xl lg:p-4 dark:bg-slate-100/5 dark:ring-slate-100/10">
              <img
                alt="nx cloud application dashboard screenshot"
                src="/images/home/nx-app-dashboard.avif"
                width={2500}
                height={1616}
                className="w-[764px] rounded-md shadow-2xl ring-1 ring-slate-900/10"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
