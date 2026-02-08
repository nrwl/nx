import { ButtonLink, SectionHeading } from '@nx/nx-dev-ui-common';
import Link from 'next/link';
import { cx } from '@nx/nx-dev-ui-primitives';
import { ComponentProps, ReactElement } from 'react';

export function FeaturesCallToAction(): ReactElement {
  return (
    <div className="bg-[url(/images/home/wave2.svg)] bg-cover bg-center dark:bg-[url(/images/home/wave-dark2.svg)]">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <SectionHeading
          as="h3"
          variant="subtitle"
          id="from-code-to-deployment-in-record-time"
          className="scroll-mt-24 text-center text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl dark:text-white"
        >
          From{' '}
          <span className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
            code to deployment
          </span>{' '}
          in record time
        </SectionHeading>
        <p className="mt-6 text-center text-lg text-slate-600 dark:text-slate-400">
          Every minute wasted is a minute not shipping value to users. Your{' '}
          <strong>Time to Green</strong>—the critical window from commit to
          merge-ready PR—relies on having intelligent tooling and seamless
          automation.
        </p>
        <div className="divide-2 mt-12 grid grid-cols-2 justify-stretch divide-white/20 rounded-lg bg-slate-950/90 ring-8 ring-slate-950/50 md:grid-cols-4 md:divide-x md:divide-solid dark:divide-slate-950/20 dark:bg-white dark:ring-white/20">
          <FeaturedStat
            stat="50%"
            description="reduction in Time to Green"
            className="border-b border-r border-white/20 md:border-0 dark:border-slate-950/20"
          />
          <FeaturedStat
            stat="70%"
            description="faster CI"
            className="border-b border-white/20 md:border-0 dark:border-slate-950/20"
          />
          <FeaturedStat
            stat="90%"
            description="fewer flaky test failures"
            className="border-r border-white/20 dark:border-slate-950/20"
          />
          <FeaturedStat stat="40%" description="fewer CI failures" />
        </div>
        <p className="mt-12 text-center text-lg text-slate-600 dark:text-slate-400">
          The difference? Intelligent caching, distributed execution, and
          AI-powered self-healing working together to create a short,{' '}
          <strong>predictable and fully automated path to a green PR</strong>.
        </p>
        <div className="mt-6 flex items-center justify-center gap-x-6">
          <ButtonLink
            href={'/contact/sales'}
            title={'Discover your time savings'}
            variant="primary"
            size="default"
          >
            Discover your time savings
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

export function FeaturedStat({
  stat,
  description,
  className,
  ...props
}: {
  stat: string;
  description: string;
} & ComponentProps<'div'>): ReactElement {
  return (
    <div className={cx('flex flex-col p-8 text-center', className)} {...props}>
      <div className="mb-1 text-5xl font-extrabold text-white dark:text-slate-800">
        {stat}
      </div>
      <div className="text-base text-slate-200 dark:text-slate-600">
        {description}
      </div>
    </div>
  );
}
