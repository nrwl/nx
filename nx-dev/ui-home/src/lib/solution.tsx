import { SectionHeading } from '@nx/nx-dev-ui-common';
import { ReactElement } from 'react';

export function Solution(): ReactElement {
  return (
    <article className="mx-auto max-w-7xl px-6 lg:px-8">
      <SectionHeading as="h2" variant="title" id="" className="scroll-mt-24">
        Nx lets you skip the tedium and get to the coding
      </SectionHeading>
      <div className="max-w-5xl">
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Nx is a powerful, open-source, build platform designed to manage
          codebases of any scale. From small single projects to large enterprise
          monorepos, Nx provides the platform to efficiently get from starting a
          feature in your editor to a green, review-ready PR.
        </SectionHeading>
      </div>
    </article>
  );
}
