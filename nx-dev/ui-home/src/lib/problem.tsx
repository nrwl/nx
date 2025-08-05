import { SectionHeading } from '@nx/nx-dev-ui-common';
import Image from 'next/image';
import { ReactElement } from 'react';

export function Problem(): ReactElement {
  return (
    <section
      id="problem"
      className="relative scroll-mt-24 border-b border-t border-slate-200 bg-slate-50 py-24 sm:py-32 dark:border-slate-800 dark:bg-slate-900"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-10 flex transform-gpu justify-center overflow-hidden blur-3xl"
        aria-hidden="true"
      >
        <div
          className="aspect-[1108/632] w-[69.25rem] flex-none bg-gradient-to-r from-pink-500 to-fuchsia-600 opacity-20"
          style={{
            clipPath:
              'polygon(73.6% 51.7%, 91.7% 11.8%, 100% 46.4%, 97.4% 0%, 92.5% 84.9%, 75.7% 64%, 10% 47.5%, 46.5% 20%, 20% 70%, 50.3% 87.2%, 21.3% 64.1%, 0.1% 100%, 5.4% 51.1%, 21.4% 63.9%, 58.9% 0.2%, 50.6% 51%)',
          }}
        />
      </div>
      <article className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-12 flex flex-col items-center gap-12 md:gap-24">
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
            className="text-center font-normal lg:mt-16 lg:max-w-[32rem] lg:leading-tight"
          >
            Most engineering work isn't that. It's:
          </SectionHeading>
          <ul className="grid grid-cols-1 items-start sm:grid-cols-2 lg:flex lg:justify-between">
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
      className={`${positionClass} mb-2 flex w-full flex-col items-center gap-2 p-2 text-center`}
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
