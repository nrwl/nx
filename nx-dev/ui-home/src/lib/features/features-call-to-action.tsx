import { ButtonLink, SectionHeading } from '@nx/nx-dev-ui-common';
import Link from 'next/link';
import { cx } from '@nx/nx-dev-ui-primitives';
import { ComponentProps, ReactElement } from 'react';

export function FeaturesCallToAction(): ReactElement {
  return (
    <div className="bg-[url(/images/home/wave2.svg)] bg-cover bg-center py-16 lg:py-24 dark:bg-[url(/images/home/wave-dark2.svg)]">
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
        <div className="divide-2 mt-12 grid grid-cols-2 justify-stretch divide-white/20 rounded-lg bg-slate-950/90 ring-8 ring-slate-950/50 md:grid-cols-4 md:divide-x md:divide-solid dark:divide-slate-950/20 dark:bg-white/90 dark:ring-white/50">
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
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <ButtonLink
            href={
              'https://cloud.nx.app/get-started?utm_source=nx-dev&utm_medium=homepage_links&utm_campaign=try-nx-cloud'
            }
            title={'Get started with Nx'}
            variant="primary"
            size="default"
          >
            Get started
          </ButtonLink>
          <Link
            href="/nx-cloud"
            title="Find out more about Nx Cloud"
            prefetch={false}
            className="group font-semibold leading-6 text-slate-950 dark:text-white"
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
      <div className="grow text-base text-slate-200 dark:text-slate-600">
        {description}
      </div>
    </div>
  );
}
