import { SectionHeading } from '@nx/nx-dev-ui-common';
import { YoutubeIcon } from '@nx/nx-dev-ui-icons';
import { JSX } from 'react';

export function CourseHero(): JSX.Element {
  return (
    <section className="relative overflow-hidden py-16 dark:from-zinc-900 dark:to-zinc-950">
      <div className="mx-auto max-w-3xl text-center">
        <SectionHeading as="h1" variant="display">
          Nx Video Courses
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Master Nx with expert-led video courses from the core team. Boost your
          skills and productivity.
        </SectionHeading>
        <a
          href="https://www.youtube.com/@nxdevtools"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15"
        >
          <YoutubeIcon className="h-5 w-5" fill="#FF0000" />
          Check out our YouTube channel for one-off educational videos
        </a>
      </div>
    </section>
  );
}
