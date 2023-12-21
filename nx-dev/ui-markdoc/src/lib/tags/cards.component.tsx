import {
  ArrowRightCircleIcon,
  ArrowTopRightOnSquareIcon,
  DocumentIcon,
  PlayCircleIcon,
} from '@heroicons/react/24/outline';
import { frameworkIcons } from '../icons';

import { cx } from '@nx/nx-dev/ui-primitives';
import { ReactNode } from 'react';

const colsClasses: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  7: 'grid-cols-7',
  8: 'grid-cols-8',
};
const smColsClasses: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
  5: 'sm:grid-cols-5',
  6: 'sm:grid-cols-6',
  7: 'sm:grid-cols-7',
  8: 'sm:grid-cols-8',
};
const mdColsClasses: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
  6: 'md:grid-cols-6',
  7: 'md:grid-cols-7',
  8: 'md:grid-cols-8',
};
const lgColsClasses: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
  7: 'lg:grid-cols-7',
  8: 'lg:grid-cols-8',
};

export function Cards({
  cols = 2,
  smCols = cols,
  mdCols = smCols,
  lgCols = mdCols,
  children,
  moreLink,
}: {
  cols: number;
  smCols: number;
  mdCols: number;
  lgCols: number;
  children: ReactNode;
  moreLink?: string;
}): JSX.Element {
  // <div className="mt-8 grid grid-cols-2 lg:grid-cols-5 md:grid-cols-3 sm:grid-cols-2 gap-4">
  return (
    <div
      className={cx(
        'mt-8 grid gap-4',
        colsClasses[cols] || '',
        smColsClasses[smCols] || '',
        mdColsClasses[mdCols] || '',
        lgColsClasses[lgCols] || ''
      )}
    >
      {children}
      {moreLink && (
        <div className="flex justify-end mt-2 col-span-full">
          <a
            className="transition-all duration-200 ease-in-out flex items-center no-underline text-sm px-4 py-0 border-transparent hover:text-slate-900 dark:hover:text-sky-400 whitespace-nowrap font-semibold group"
            href={moreLink}
          >
            Browse more
            <span
              className="pl-1 transition-all duration-200 ease-in-out group-hover:translate-x-1"
              aria-hidden="true"
            >
              →
            </span>
          </a>
        </div>
      )}
    </div>
  );
}

export function LinkCard({
  title,
  type,
  icon,
  url,
  appearance = 'default',
}: {
  title: string;
  type: string;
  icon: string; // `icon` is the link to the SVG file
  url: string;
  appearance?: 'default' | 'small';
}): JSX.Element {
  return (
    <a
      key={title}
      href={url}
      className="no-prose relative col-span-1 flex flex-col items-center rounded-md border border-slate-200 bg-slate-50/40 p-4 text-center font-semibold shadow-sm transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 hover:bg-slate-100 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:bg-slate-800"
      style={{ textDecorationLine: 'none' }}
    >
      {icon && (
        <div
          className={cx(
            'flex items-center justify-center w-24 h-24 rounded-lg mb-2',
            {
              'h-12 w-12': appearance === 'small',
            }
          )}
        >
          {icon && frameworkIcons[icon]?.image}
        </div>
      )}
      <div className={cx('pt-4', { 'pt-2': appearance === 'small' })}>
        {appearance === 'small' && type ? null : (
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300 uppercase mb-1">
            {type}
          </div>
        )}
        <h3
          className={cx(
            'text-lg font-semibold text-slate-900 dark:text-white m-0',
            { 'text-sm font-normal': appearance === 'small' }
          )}
        >
          {title}
        </h3>
      </div>
    </a>
  );
}

export function Card({
  description,
  title,
  type = 'documentation',
  url,
}: {
  title: string;
  description: string;
  type: 'documentation' | 'external' | 'video';
  url: string;
}): JSX.Element {
  const iconMap = {
    documentation: <DocumentIcon className="mr-3 h-5 w-5 shrink-0" />,
    external: <ArrowTopRightOnSquareIcon className="mr-3 h-5 w-5 shrink-0" />,
    video: <PlayCircleIcon className="mr-3 h-5 w-5 shrink-0" />,
  };
  const youtubeRegex =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/gi.exec(
      url
    );
  const hasYoutubeId = !!youtubeRegex ? youtubeRegex[1] : '';

  return (
    <a
      key={title}
      href={url}
      title={title}
      className="group no-underline flex flex-col items-stretch rounded-md border border-slate-200 bg-slate-50/40 text-sm shadow-sm transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 hover:bg-slate-50 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:bg-slate-800"
    >
      {!!hasYoutubeId && (
        <div className="max-h-24">
          <img
            className="!m-0 rounded-t-md bg-black object-contain !w-full h-full"
            alt="Youtube Link"
            src={`https://img.youtube.com/vi/${hasYoutubeId}/default.jpg`}
          />
        </div>
      )}
      <div className="relative flex flex-col p-3 pr-8">
        <span className="flex items-center font-semibold underline">
          <span className="absolute inset-0" aria-hidden="true"></span>
          {!hasYoutubeId ? iconMap[type] : null}
          {title}
        </span>
        {description ? (
          <p className="mt-1.5 w-full text-sm no-underline">{description}</p>
        ) : null}

        {/*HOVER ICON*/}
        <span className="absolute right-2 top-1/2 -translate-y-2.5 -translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">
          <ArrowRightCircleIcon className="h-5 w-5" />
        </span>
      </div>
    </a>
  );
}
