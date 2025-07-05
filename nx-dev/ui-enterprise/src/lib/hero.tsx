import { ButtonLink, SectionHeading } from '@nx/nx-dev/ui-common';
import { type ReactElement } from 'react';
import { sendCustomEvent } from '@nx/nx-dev/feature-analytics';
import { WebinarSection } from './webinar-section';

export function Hero(): ReactElement {
  return (
    <section className="relative overflow-hidden">
      <div className="relative isolate h-[868px] border-b border-slate-200 dark:border-slate-800">
        <img
          alt="hero illustration"
          src="/images/enterprise/hero-light.avif"
          width={4573}
          height={2114}
          className="h-full max-w-full object-cover object-left-top opacity-40 dark:hidden"
        />
        <img
          alt="hero illustration"
          src="/images/enterprise/hero-dark.avif"
          width={4573}
          height={2114}
          className="hidden h-full max-w-full object-cover object-left-top opacity-40 dark:block"
        />
      </div>
      <div className="absolute inset-0">
        <div className="mx-auto max-w-7xl lg:flex">
          <div className="mx-auto max-w-3xl px-6 pb-24 pt-36 lg:mx-0 lg:shrink-0 lg:px-8">
            <WebinarSection />
            <SectionHeading
              id="get-speed-and-scale"
              as="h1"
              variant="display"
              className="mt-8 text-pretty tracking-tight"
            >
              Develop like an enterprise.{' '}
              <span className="rounded-lg bg-gradient-to-r from-pink-500 to-fuchsia-500 bg-clip-text text-transparent">
                Deliver like a startup.
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
        </div>
      </div>
    </section>
  );
}
