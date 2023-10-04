import {
  ArrowRightCircleIcon,
  ArrowTopRightOnSquareIcon,
  DocumentIcon,
  PlayCircleIcon,
} from '@heroicons/react/24/outline';
import { frameworkIcons } from '../icons';

import { cx } from '@nx/nx-dev/ui-primitives';
import { ReactNode } from 'react';

export function Cards({
  cols = 2,
  smCols = 3,
  mdCols = 4,
  lgCols = 4,
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
  const calcCols = (cols: number, size: '' | 'lg' | 'md' | 'sm') => {
    if (size === '') return `grid-cols-${cols}`;
    return `${size}:grid-cols-${cols}`;
  };
  // <div className="mt-8 grid grid-cols-2 lg:grid-cols-5 md:grid-cols-3 sm:grid-cols-2 gap-4">
  return (
    <div
      className={`mt-8 grid gap-4 ${calcCols(cols, '')} ${calcCols(
        smCols,
        'sm'
      )} ${calcCols(mdCols, 'md')} ${calcCols(lgCols, 'lg')}`}
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
    <div
      key={title}
      className="group relative flex rounded-md border border-slate-200 bg-slate-50/40 pr-8 text-sm shadow-sm transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 hover:bg-slate-50 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:bg-slate-800"
    >
      {!!hasYoutubeId && (
        <img
          className="!m-0 rounded-l-md bg-black object-contain"
          alt="Youtube Link"
          src={`https://img.youtube.com/vi/${hasYoutubeId}/default.jpg`}
        />
      )}
      <div className="flex flex-col p-3 pr-0">
        <a href={url} title={title} className="flex items-center font-semibold">
          <span className="absolute inset-0" aria-hidden="true"></span>
          {!hasYoutubeId ? iconMap[type] : null}
          {title}
        </a>
        {description ? (
          <p className="mt-1.5 w-full text-sm">{description}</p>
        ) : null}

        {/*HOVER ICON*/}
        <span className="absolute right-2 top-1/2 -translate-y-2.5 -translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">
          <ArrowRightCircleIcon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}
