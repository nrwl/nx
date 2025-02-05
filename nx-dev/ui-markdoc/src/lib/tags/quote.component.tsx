import { cx } from '@nx/nx-dev/ui-primitives';

export interface QuoteProps {
  quote: string;
  author: string;
  title?: string;
  companyIcon?: string;
}

export function Quote({
  quote,
  author,
  title,
  companyIcon,
}: QuoteProps): JSX.Element {
  return (
    <figure className="not-prose relative my-8 rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-900/5 dark:bg-slate-800">
      <svg
        className="absolute left-6 top-6 h-12 w-12 text-slate-100 dark:text-slate-700"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
      </svg>

      <blockquote className="relative">
        <p className="pl-12 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
          {quote}
        </p>
      </blockquote>

      <div className="mt-6 flex items-center gap-x-4 pl-12">
        <div className="flex-auto">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {author}
          </div>
          {title && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {title}
            </div>
          )}
        </div>
        {companyIcon && (
          <div className="h-10 w-10 flex-none overflow-hidden">
            <img
              src={companyIcon}
              aria-hidden="true"
              className="h-full w-full object-contain"
              alt="Company logo"
            />
          </div>
        )}
      </div>
    </figure>
  );
}
