import { SectionHeading, Strong, TextLink } from '@nx/nx-dev-ui-common';
import { ReactElement } from 'react';

export function CallToActionJuriGraphic(): ReactElement {
  return (
    <article className="mx-auto max-w-7xl px-6 lg:px-8">
      <SectionHeading
        as="h2"
        variant="title"
        id=""
        className="sr-only scroll-mt-24"
      >
        (Juri's graphic)
      </SectionHeading>
      <div
        className="relative flex h-[40rem] w-full items-center justify-center rounded-lg bg-slate-100"
        title="placeholder for Juri's graphic"
      >
        <span className="text-2xl font-bold text-slate-300">
          Juri's graphic
        </span>
      </div>
    </article>
  );
}
