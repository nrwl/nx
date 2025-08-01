import { SectionHeading } from '@nx/nx-dev-ui-common';
import { ReactElement } from 'react';

export function Solution(): ReactElement {
  return (
    <article className="mx-auto max-w-7xl px-6 lg:px-8">
      <SectionHeading as="h2" variant="title" id="" className="scroll-mt-24">
        Skip the tedium. Get to coding.
      </SectionHeading>
      <div className="max-w-5xl"></div>
    </article>
  );
}
