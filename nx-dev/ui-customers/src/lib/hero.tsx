'use client';
import { sendCustomEvent } from '@nx/nx-dev-feature-analytics';
import { ButtonLink, SectionHeading } from '@nx/nx-dev-ui-common';
import { type ReactElement } from 'react';

export function Hero(): ReactElement {
  return (
    <section>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mx-auto max-w-3xl text-3xl font-normal tracking-tight text-slate-700 sm:text-4xl dark:text-slate-400">
            We empower our clients to
          </p>
          <SectionHeading
            as="h1"
            variant="display"
            className="pt-4 text-4xl sm:text-5xl md:text-6xl"
          >
            Build Smarter & Ship Faster
          </SectionHeading>
          <div className="mt-16 flex items-center justify-center gap-x-6">
            <ButtonLink
              href="https://cloud.nx.app/get-started"
              title="Get started now"
              variant="primary"
              size="default"
              onClick={() =>
                sendCustomEvent('get-started-click', 'hero', 'customers')
              }
            >
              Get started now
            </ButtonLink>
            <ButtonLink
              href="/contact/sales"
              title="Book a demo"
              variant="secondary"
              size="default"
              onClick={() =>
                sendCustomEvent(
                  'contact-sales-click',
                  'customers-hero-book-demo',
                  'customers'
                )
              }
            >
              Book a demo
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
