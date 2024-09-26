'use client';
import { ButtonLink, SectionHeading, Strong } from '@nx/nx-dev/ui-common';
import { ReactElement } from 'react';

export function Hero(): ReactElement {
  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <SectionHeading as="h1" variant="display">
          Nx Powerpack
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6 text-center">
          A suite of paid extensions for the Nx CLI specifically designed for
          enterprises, <Strong>built and supported by the Nx core team</Strong>.
        </SectionHeading>
        <div className="mt-10 text-center">
          <ButtonLink
            href="https://cloud.nx.app/powerpack/purchase?utm_source=nx.dev&utm_medium=referral&utm_campaign=nx-powerpackurl"
            title="Talk to the engineering team"
            variant="primary"
            size="default"
          >
            Get Powerpack
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
