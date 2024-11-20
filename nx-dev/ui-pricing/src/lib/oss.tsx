import { ButtonLink, SectionHeading } from '@nx/nx-dev/ui-common';
import { ReactElement } from 'react';

export function Oss(): ReactElement {
  return (
    <section id="oss" className="isolate">
      <div className="mx-auto max-w-4xl bg-slate-50/80 px-6 py-16 ring-1 ring-slate-200 sm:rounded-3xl sm:p-8 lg:py-16 xl:px-16 dark:bg-slate-800/60 dark:ring-white/10">
        <div className="mx-auto max-w-2xl text-center">
          <SectionHeading as="h2" variant="title">
            Open Source maintainers <br /> and authors?
          </SectionHeading>
          <SectionHeading as="p" variant="subtitle" className="mt-6">
            We provide a <span className="font-black">free</span> plan for
            open-source projects.
          </SectionHeading>
          <div className="mt-8 flex items-center justify-center">
            <ButtonLink
              href="/pricing/special-offer"
              aria-describedby="oss"
              title="Free for Open Source"
              size="default"
              variant="secondary"
            >
              Apply for free access
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
