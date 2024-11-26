import { cx } from '@nx/nx-dev/ui-primitives';
import Link from 'next/link';
import { ReactNode } from 'react';

export const BentoGrid = ({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) => {
  return (
    <div
      className={cx(
        'mx-auto grid max-w-7xl grid-cols-1 gap-4 md:auto-rows-[24rem] md:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {children}
    </div>
  );
};

export const BentoGridItem = ({
  className,
  title,
  description,
  header,
  url = '',
  icon,
}: {
  className?: string;
  title?: string | ReactNode;
  description?: string | ReactNode;
  header?: ReactNode;
  icon?: ReactNode;
  url?: string;
}) => {
  return (
    <div
      className={cx(
        'group/bento shadow-input row-span-1 flex flex-col justify-between space-y-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 transition duration-200 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none',
        className
      )}
    >
      <div className="pointer-events-none relative">
        <div className="mb-2 mt-2 flex flex-row items-center gap-2 font-sans font-bold text-slate-600 dark:text-slate-200">
          {icon} {title}
        </div>
        <div className="font-sans text-sm font-normal text-slate-600 dark:text-slate-400">
          {description}
        </div>
        {url ? (
          <Link
            href={url}
            title="Learn more"
            className="float-right text-sm font-medium transition duration-200 group-hover/bento:text-blue-500 group-hover/bento:dark:text-sky-500"
          >
            <span className="group absolute inset-0" />

            <span
              className="inline-block transition duration-200 group-hover/bento:translate-x-2"
              aria-hidden="true"
            >
              →
            </span>
          </Link>
        ) : null}
      </div>
      {header}
    </div>
  );
};
