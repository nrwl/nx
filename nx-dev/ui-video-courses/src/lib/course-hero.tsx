import { SectionHeading } from '@nx/nx-dev-ui-common';
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
          href="https://www.youtube.com/@naborx"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15"
        >
          <svg
            role="img"
            viewBox="0 0 24 24"
            className="h-5 w-5 fill-[#FF0000]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
          Check out our YouTube channel for one-off educational videos
        </a>
      </div>
    </section>
  );
}
