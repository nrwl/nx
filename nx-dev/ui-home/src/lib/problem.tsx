import { WrenchIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { SectionHeading, Strong, TextLink } from '@nx/nx-dev-ui-common';
import Image from 'next/image';
import { ReactElement } from 'react';

export function Problem(): ReactElement {
  return (
    <section
      id="ci-bottleneck"
      className="scroll-mt-24 border-b border-t border-slate-200 bg-slate-50 py-24 sm:py-32 dark:border-slate-800 dark:bg-slate-900"
    >
      <article className="mx-auto max-w-7xl px-6 lg:px-8">
        <Image
          src="/images/home/problem.webp"
          width={2400}
          height={800}
          alt="problem-sketch"
          className="max-w-[full] lg:max-w-[full]"
        />
        {/* <SectionHeading
          as="h2"
          variant="title"
          id=""
          className="mb-12 scroll-mt-24"
        >
          Developers want to code.
        </SectionHeading>
        <SectionHeading
          as="h2"
          variant="title"
          id=""
          className="ml-14 scroll-mt-24 text-nowrap"
        >
          Businesses want to ship.
        </SectionHeading> */}
        {/* <div className="mb-12 flex items-center gap-24">
          <div className="flex w-1/2 flex-col gap-12">
            <SectionHeading
              as="h2"
              variant="title"
              id=""
              className="scroll-mt-24 text-nowrap"
            >
              Developers want to code.
            </SectionHeading>
            <SectionHeading
              as="h2"
              variant="title"
              id=""
              className="ml-14 scroll-mt-24 text-nowrap"
            >
              Businesses want to ship.
            </SectionHeading>
          </div>
          <div className="w-1/2">
            <SectionHeading as="p" variant="subtitle" className="mt-6">
              Most of the engineering work isn’t that. It’s:
            </SectionHeading>
            <Image
              src="/images/home/problem-v1.png"
              width={2400}
              height={800}
              alt="problem-sketch"
              className="max-w-[full] lg:max-w-[full] dark:hidden"
            />
            <ul className="mt-4 flex flex-col items-start">
            <ProblemListItem>
              Wrestling with slow local builds and tests
            </ProblemListItem>
            <ProblemListItem>
              Keeping CI fast, reliable, and flake-free
            </ProblemListItem>
            <ProblemListItem>
              Attending to PRs to get them landed
            </ProblemListItem>
            <ProblemListItem>
              Configuring disparate tools to work together cohesively
            </ProblemListItem>
            <ProblemListItem>
              Figuring out how to share code between projects in a scalable way
            </ProblemListItem>
            <ProblemListItem>
              Architecting systems consistently so you're as productive 12
              months from now as you are today
            </ProblemListItem>
          </ul>
          </div>
        </div> */}
      </article>
    </section>
  );
}

export function ProblemListItem({
  children,
}: {
  children: ReactElement | ReactElement[] | string;
}): ReactElement {
  return (
    <li className="mb-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 p-2">
      <WrenchIcon className="h-5 w-5 shrink-0 text-slate-400" />
      {children}
    </li>
  );
}
