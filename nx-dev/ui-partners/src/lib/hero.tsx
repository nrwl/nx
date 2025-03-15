import { SectionHeading, Strong } from '@nx/nx-dev/ui-common';
import { type ReactElement } from 'react';

export function Hero(): ReactElement {
  return (
    <section>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
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
            At Nx, we believe in the power of collaboration to drive innovation,
            scalability and improve developer productivity. Our{' '}
            <Strong>Certified Community Partners</Strong> play a crucial role in
            expanding the reach of Nx by providing high-quality services, expert
            guidance, and valuable resources to developers and organizations
            using Nx.
          </SectionHeading>
        </div>
      </div>
    </section>
  );
}
