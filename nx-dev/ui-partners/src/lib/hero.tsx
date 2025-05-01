import { SectionHeading, Strong } from '@nx/nx-dev/ui-common';
import { type ReactElement } from 'react';

export function Hero(): ReactElement {
  return (
    <section>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <SectionHeading
            as="h1"
            variant="display"
            className="pt-4 text-4xl sm:text-5xl md:text-6xl"
          >
            Nx Partners
          </SectionHeading>
          <SectionHeading
            as="p"
            variant="subtitle"
            className="mt-6 text-left sm:text-lg"
          >
            Hire Nx Certified Experts to help you adopt best practices,
            implement Nx Cloud, and accelerate your CI.
          </SectionHeading>
        </div>
      </div>
    </section>
  );
}
