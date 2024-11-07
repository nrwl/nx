import { SectionHeading } from '@nx/nx-dev/ui-common';
import { JSX } from 'react';

export function CourseHero(): JSX.Element {
  return (
    <section className="relative overflow-hidden py-16 dark:from-slate-900 dark:to-slate-950">
      <div className="mx-auto max-w-3xl text-center">
        <SectionHeading as="h1" variant="display">
          Nx Video Courses
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Master Nx with expert-led video courses from the core team. Boost your
          skills and productivity.
        </SectionHeading>
      </div>
    </section>
  );
}
