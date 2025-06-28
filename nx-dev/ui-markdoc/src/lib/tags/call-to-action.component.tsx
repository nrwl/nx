import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { Framework, frameworkIcons } from '@nx/graph/legacy/icons';
import classNames from 'classnames';

const iconSizeClasses: Record<string, { icon: string; chevron: string }> = {
  sm: { icon: 'h-10 w-10', chevron: 'h-6 w-6' },
  md: { icon: 'h-16 w-16', chevron: 'h-10 w-10' },
  lg: { icon: 'h-24 w-24', chevron: 'h-16 w-16' },
};

export function CallToAction({
  url,
  title,
  description,
  icon = 'nx',
  size = 'sm',
}: {
  url: string;
  title: string;
  description?: string;
  icon?: string;
  size?: 'sm' | 'md' | 'lg';
}): JSX.Element {
  const iconClasses = iconSizeClasses[size];
  return (
    <div className="not-prose group relative mx-auto my-12 flex w-full max-w-md items-center gap-3 overflow-hidden rounded-lg bg-slate-50 shadow-md transition hover:text-white dark:bg-slate-800/60">
      <div className="absolute inset-0 z-0 w-2 bg-blue-500 transition-all duration-150 group-hover:w-full dark:bg-sky-500"></div>
      <div className="w-2 bg-blue-500 dark:bg-sky-500"></div>

      <div className="z-10 flex flex-grow items-center py-3">
        <div className={iconClasses.icon}>
          {icon && frameworkIcons[icon as Framework]?.image}
        </div>

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
      <ChevronRightIcon
        className={classNames(
          iconClasses.chevron,
          'mr-4 transition-all group-hover:translate-x-3'
        )}
      />
    </div>
  );
}
