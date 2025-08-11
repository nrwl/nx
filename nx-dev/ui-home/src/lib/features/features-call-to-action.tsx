import { SectionHeading } from '@nx/nx-dev-ui-common';
import Link from 'next/link';
import { cx } from '@nx/nx-dev-ui-primitives';
import { ComponentProps, ReactElement } from 'react';

export function FeaturesCallToAction(): ReactElement {
  return (
    <div className="mx-auto max-w-5xl px-6 lg:px-8">
      <SectionHeading
        as="h3"
        variant="subtitle"
        id="from-code-to-deployment-in-record-time"
        className="scroll-mt-24 text-center text-4xl font-medium tracking-tight text-slate-950 sm:text-5xl dark:text-white"
      >
        From code to deployment in record time
      </SectionHeading>
      <p className="mt-6 text-center text-lg text-slate-600 dark:text-slate-400">
        Every minute wasted is a minute not shipping value to users. Your Time
        to Green—the critical window from commit to merge-ready PR—relies on
        having intelligent tooling and seamless automation.
      </p>
      <div className="mt-12 grid grid-cols-2 justify-stretch rounded-lg bg-slate-800 ring-4 ring-slate-950/50 sm:grid-cols-4 sm:divide-x sm:divide-solid sm:divide-slate-950">
        <FeaturedStat
          stat="50%"
          description="reduction in Time to Green"
          className="border-b border-r border-slate-950 sm:border-0"
        />
        <FeaturedStat
          stat="70%"
          description="faster CI"
          className="border-b border-slate-950 sm:border-0"
        />
        <FeaturedStat
          stat="90%"
          description="fewer flaky test failures"
          className="border-r border-slate-950"
        />
        <FeaturedStat stat="40%" description="fewer CI failures" className="" />
      </div>
      <div className="mt-10 flex items-center justify-center gap-x-6">
        <Link
          href={
            'https://cloud.nx.app/get-started?utm_source=nx-dev&utm_medium=homepage_links&utm_campaign=try-nx-cloud'
          }
          title={'Get started with Nx'}
          prefetch={false}
          className="rounded-md bg-slate-950 px-3.5 py-2.5 text-sm font-semibold text-slate-100 shadow-sm hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          Get started
        </Link>
        <Link
          href="/contact"
          title="Get in touch"
          prefetch={false}
          className="group text-sm font-semibold leading-6 text-slate-950 dark:text-white"
        >
          Learn more{' '}
          <span
            aria-hidden="true"
            className="inline-block transition group-hover:translate-x-1"
          >
            →
          </span>
        </Link>
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
    <div
      className={cx(
        'grid items-center justify-center p-8 text-center',
        className
      )}
      {...props}
    >
      <div className="text-4xl font-bold">{stat}</div>
      <div className="text-lg text-slate-600 dark:text-slate-400">
        {description}
      </div>
    </div>
  );
}
