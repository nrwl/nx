import Link from 'next/link';
import { ReactNode } from 'react';
import { cx } from '@nx/nx-dev/ui-primitives';

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
        'mx-auto grid max-w-7xl grid-cols-1 gap-4 md:auto-rows-[24rem] md:grid-cols-2 lg:grid-cols-3 ',
        className
      )}
    >
      {children}
    </div>
  );
};

export const BentoGridItem = ({
  className,
  title = null,
  description = null,
  header,
  url = null,
  icon,
}: {
  className?: string;
  title?: string | ReactNode | null;
  description?: string | ReactNode | null;
  header: ReactNode;
  icon?: ReactNode;
  url?: string | null;
}) => {
  return (
    <div
      className={cx(
        'group/bento shadow-input relative row-span-1 flex flex-col justify-between space-y-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 transition duration-200 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none',
        className
      )}
    >
      {header}
      <div className="mt-2 flex items-start">
        <div className="grow">
          <div className="flex items-center gap-2 font-sans font-bold text-slate-800 transition duration-200 group-hover/bento:text-blue-500 dark:text-slate-200 group-hover/bento:dark:text-sky-500">
            {icon} {title}
          </div>
          {description && (
            <div className="mt-2 font-sans text-sm font-normal text-slate-600 transition duration-200 group-hover/bento:text-blue-500 dark:text-slate-400 group-hover/bento:dark:text-sky-500">
              {description}
            </div>
          )}
        </div>
        {url ? (
          <Link
            href={url}
            title="Learn more"
            className="float-right text-sm font-medium transition duration-200 group-hover/bento:text-blue-500 group-hover/bento:dark:text-sky-500"
            prefetch={false}
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
    </div>
  );
};
