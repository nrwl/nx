import type { ReactElement } from 'react';
import { SectionHeading, Strong } from '@nx/nx-dev/ui-common';

export function SolutionsTopCallToAction(): ReactElement {
  return (
    <div className="border border-slate-100 bg-slate-50 px-6 py-24 sm:px-6 sm:py-32 lg:px-8 dark:border-slate-900 dark:bg-slate-900/[0.8]">
      <div className="mx-auto max-w-3xl text-center">
        <SectionHeading as="h2" variant="title" id="unlock-peak-performance">
          Unlock Peak Performance for <br className="lg:block" /> Your
          Development Teams
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Get the tools and structure to tackle complex projects, streamline
          workflows, and{' '}
          <Strong>empower your engineers to do their best work</Strong>.
        </SectionHeading>
      </div>
    </div>
  );
}
