import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { frameworkIcons } from '../icons';

export function CallToAction({
  url,
  title,
  description,
  icon = 'nx',
}: {
  url: string;
  title: string;
  description?: string;
  icon?: string;
}): JSX.Element {
  return (
    <div className="not-prose group relative my-12 mx-auto flex w-full max-w-md items-center gap-3 overflow-hidden rounded-lg bg-slate-50 shadow-md transition hover:text-white dark:bg-slate-800/60">
      <div className="absolute inset-0 z-0 w-2 bg-blue-500 transition-all duration-150 group-hover:w-full dark:bg-sky-500"></div>
      <div className="w-2 bg-blue-500 dark:bg-sky-500"></div>

      <div className="z-10 flex flex-grow items-center py-3">
        <div className="h-10 w-10">{icon && frameworkIcons[icon]?.image}</div>

        <div className="mx-3">
          <p>
            {title}
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block text-sm font-medium opacity-80"
            >
              <span className="absolute inset-0" aria-hidden="true"></span>
              {description || ''}
            </a>
          </p>
        </div>
      </div>
      <ChevronRightIcon className="mr-4 h-6 w-6 transition-all group-hover:translate-x-3" />
    </div>
  );
}
