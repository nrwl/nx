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
        <div className="mb-12 flex flex-col items-center gap-24">
          <SectionHeading
            as="h2"
            variant="title"
            id=""
            className="scroll-mt-24 text-center"
          >
            Developers want to code. Businesses want to ship.
          </SectionHeading>
          <SectionHeading
            as="h2"
            variant="title"
            id=""
            className="max-w-[32rem] scroll-mt-24 text-center sm:leading-tight"
          >
            Most of the engineering work isn't that. It's:
          </SectionHeading>
          <ul className="mt-4 flex flex-col items-start gap-12 lg:flex-row">
            <ProblemListItem imageId="sharing-code" position={['top', 'left']}>
              Figuring out how to share code between teams
            </ProblemListItem>
            <ProblemListItem
              imageId="disparate-tools"
              position={['middle', 'center']}
            >
              Integrating disparate development tools
            </ProblemListItem>
            <ProblemListItem
              imageId="slow-local-builds"
              position={['bottom', 'center']}
            >
              Wrestling with slow local builds and tests
            </ProblemListItem>
            <ProblemListItem
              imageId="attending-prs"
              position={['middle', 'center']}
            >
              Attending to PRs to get them landed
            </ProblemListItem>
            <ProblemListItem
              imageId="fast-reliable-ci"
              position={['top', 'right']}
            >
              Keeping CI fast, reliable and flake-free
            </ProblemListItem>
          </ul>
        </div>
      </article>
    </section>
  );
}

export function ProblemListItem({
  children,
  imageId,
  position,
}: {
  children: ReactElement | ReactElement[] | string;
  imageId: string;
  position: ['top' | 'middle' | 'bottom', 'left' | 'center' | 'right'];
}): ReactElement {
  // TODO: convert togrid layout instead.
  let positionClass =
    position[0] === 'top'
      ? 'lg:-mt-64'
      : position[0] === 'middle'
      ? 'lg:-mt-12'
      : '';

  return (
    <li
      className={`${positionClass} mb-2 flex flex-col items-center gap-2 p-2 text-center`}
    >
      <Image
        src={`/images/home/problem-${imageId}.svg`}
        width={350}
        height={250}
        alt="problem"
        className="max-w-48 dark:hidden"
      />
      <Image
        src={`/images/home/problem-${imageId}-dark.svg`}
        width={350}
        height={250}
        alt="problem"
        className="hidden max-w-48 dark:block"
      />
      <span className="mx-4">{children}</span>
    </li>
  );
}
