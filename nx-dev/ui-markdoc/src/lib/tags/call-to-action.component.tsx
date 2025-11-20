import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { type Framework, frameworkIcons } from '@nx/graph-ui-icons';
import classNames from 'classnames';

const iconSizeClasses: Record<
  string,
  { icon: string; chevron: string; width: string }
> = {
  sm: { icon: 'h-10 w-10', chevron: 'h-6 w-6', width: 'max-w-md' },
  md: { icon: 'h-16 w-16', chevron: 'h-10 w-10', width: 'max-w-lg' },
  lg: { icon: 'h-24 w-24', chevron: 'h-16 w-16', width: 'max-w-xl' },
};

const variantClasses: Record<
  string,
  {
    container: string;
    accent: string;
    hoverText: string;
    expandBg: string;
  }
> = {
  default: {
    container: 'bg-slate-50 dark:bg-slate-800/60',
    accent: 'bg-blue-500 dark:bg-sky-500',
    hoverText: 'hover:text-white',
    expandBg: 'group-hover:w-full',
  },
  gradient: {
    container:
      'bg-gradient-to-r from-blue-500 via-sky-400 to-blue-500 dark:from-sky-600 dark:via-blue-500 dark:to-sky-600',
    accent: 'dark:bg-white bg-blue-500',
    hoverText: 'hover:text-sky-100 dark:hover:text-slate-900 text-white',
    expandBg: 'group-hover:w-full',
  },
  inverted: {
    container: 'bg-slate-800 dark:bg-slate-100',
    accent: 'bg-sky-400 dark:bg-blue-600',
    hoverText:
      'hover:text-slate-900 dark:hover:text-white text-white dark:text-slate-900',
    expandBg: 'group-hover:w-full',
  },
  'gradient-alt': {
    container:
      'bg-gradient-to-br from-blue-600 via-sky-400 to-blue-300 dark:from-blue-800 dark:via-sky-600 dark:to-blue-400',
    accent: 'bg-blue-800 dark:bg-sky-500',
    hoverText: 'hover:text-blue-100 dark:hover:text-sky-200 text-white',
    expandBg: 'group-hover:w-full',
  },
  simple: {
    container: 'bg-blue-600 dark:bg-blue-600',
    accent: 'bg-transparent',
    hoverText: 'text-white',
    expandBg: '',
  },
};

export type CallToActionProps = {
  url: string;
  title: string;
  description?: string;
  icon?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'gradient' | 'inverted' | 'gradient-alt' | 'simple';
};

export function CallToAction({
  url,
  title,
  description,
  icon = 'nx',
  size = 'sm',
  variant = 'default',
}: CallToActionProps): JSX.Element {
  const iconClasses = iconSizeClasses[size];
  const colorClasses = variantClasses?.[variant] ?? variantClasses['default'];

  if (variant === 'simple') {
    return (
      <div className="not-content not-prose mx-auto my-12 flex justify-center">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={classNames(
            colorClasses.container,
            colorClasses.hoverText,
            'inline-flex items-center gap-2 rounded-md px-6 py-3 font-medium no-underline shadow-sm'
          )}
        >
          {title}
          <ChevronRightIcon className="h-5 w-5" />
        </a>
      </div>
    );
  }

  return (
    <div
      className={classNames(
        iconClasses.width,
        colorClasses.container,
        colorClasses.hoverText,
        'not-content not-prose group relative mx-auto my-12 flex w-full items-center gap-3 overflow-hidden rounded-lg shadow-md transition'
      )}
    >
      <div
        className={classNames(
          'absolute inset-0 z-0 w-2 transition-all duration-150',
          colorClasses.accent,
          colorClasses.expandBg
        )}
      ></div>
      <div className={classNames('w-2', colorClasses.accent)}></div>

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
              className="block text-sm font-medium text-inherit no-underline opacity-80"
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
