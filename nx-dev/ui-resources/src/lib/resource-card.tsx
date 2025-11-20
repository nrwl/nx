import Link from 'next/link';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { Resource } from './types';

interface ResourceCardProps {
  resource: Resource;
}

export function ResourceCard({ resource }: ResourceCardProps) {
  return (
    <article className="group relative flex h-full flex-row overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      {/* Cover Image */}
      <div className="relative flex min-w-[140px] max-w-[240px] shrink-0 items-center overflow-hidden bg-slate-100 dark:bg-slate-800">
        <img
          src={resource.coverImage}
          alt={resource.title}
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-center p-4">
        {/* Category Badge */}
        <div className="mb-2">
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {resource.category === 'whitepaper' && 'Whitepaper'}
            {resource.category === 'book' && 'Book'}
            {resource.category === 'case-study' && 'Case Study'}
            {resource.category === 'cheatsheet' && 'Cheatsheet'}
          </span>
        </div>

        {/* Title */}
        <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-slate-100">
          {resource.title}
        </h3>

        {/* Description */}
        {resource.description && (
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
            {resource.description}
          </p>
        )}

        {/* Download Button */}
        <div>
          <Link
            href={resource.downloadUrl}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-600 dark:bg-sky-500 dark:hover:bg-sky-600"
            aria-label={`Download ${resource.title}`}
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Download
          </Link>
        </div>
      </div>
    </article>
  );
}
