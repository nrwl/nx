import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { type Framework, frameworkIcons } from '@nx/graph-ui-icons';
import classNames from 'classnames';

const iconSizeClasses: Record<
  string,
  { icon: string; lockup: string; chevron: string; width: string }
> = {
  sm: {
    icon: 'h-10 w-10',
    lockup: 'h-10',
    chevron: 'h-6 w-6',
    width: 'max-w-md',
  },
  md: {
    icon: 'h-16 w-16',
    lockup: 'h-16',
    chevron: 'h-10 w-10',
    width: 'max-w-lg',
  },
  lg: {
    icon: 'h-24 w-24',
    lockup: 'h-24',
    chevron: 'h-16 w-16',
    width: 'max-w-xl',
  },
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
    container: 'bg-zinc-50 dark:bg-zinc-800/60',
    accent: 'bg-blue-500 dark:bg-blue-500',
    hoverText: 'hover:text-white',
    expandBg: 'group-hover:w-full',
  },
  gradient: {
    container:
      'bg-gradient-to-r from-blue-500 via-blue-400 to-blue-500 dark:from-blue-600 dark:via-blue-500 dark:to-blue-600',
    accent: 'dark:bg-white bg-blue-500',
    hoverText: 'hover:text-blue-100 dark:hover:text-zinc-900 text-white',
    expandBg: 'group-hover:w-full',
  },
  inverted: {
    container: 'bg-zinc-800 dark:bg-zinc-100',
    accent: 'bg-blue-400 dark:bg-blue-600',
    hoverText:
      'hover:text-zinc-900 dark:hover:text-white text-white dark:text-zinc-900',
    expandBg: 'group-hover:w-full',
  },
  'gradient-alt': {
    container:
      'bg-gradient-to-br from-blue-600 via-blue-400 to-blue-300 dark:from-blue-800 dark:via-blue-600 dark:to-blue-400',
    accent: 'bg-blue-800 dark:bg-blue-500',
    hoverText: 'hover:text-blue-100 dark:hover:text-blue-200 text-white',
    expandBg: 'group-hover:w-full',
  },
  simple: {
    container: 'bg-blue-600 dark:bg-blue-600',
    accent: 'bg-transparent',
    hoverText: 'text-white',
    expandBg: '',
  },
};

// The full Nx lockup (mark and "x"). Wider than the square framework icons, so
// the card gives it its own box.
function NxLockup(): JSX.Element {
  return (
    <svg
      role="img"
      fill="currentColor"
      className="h-full w-full"
      viewBox="0 0 582 314"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Nx</title>
      <path d="M303.126 6.95607e-06L372.135 9.23063e-07C377.59 4.46199e-07 381.674 5.00092 380.585 10.3457L330.576 255.651C323.679 289.482 293.924 313.783 259.398 313.783C230.675 313.783 204.65 296.859 193 270.605L139.152 149.26C135.78 141.661 124.666 142.764 122.854 150.878L87.9797 307.039C87.0995 310.98 83.6021 313.783 79.5638 313.783L10.5525 313.783C5.09982 313.783 1.01599 308.785 2.10217 303.442L51.9406 58.2619C58.8319 24.3605 88.6424 -6.58459e-05 123.237 -6.88703e-05C151.999 -7.13847e-05 178.061 16.9437 189.732 43.2305L243.695 164.766C247.071 172.369 258.192 171.256 259.994 163.136L294.707 6.75452C295.583 2.80814 299.083 7.30947e-06 303.126 6.95607e-06Z" />
      <path d="M452.783 156.792H410.33C403.085 156.792 399.069 148.398 403.617 142.757L450.732 84.3113C453.264 81.1695 453.279 76.6914 450.768 73.5327L403.426 13.9898C398.933 8.33958 402.957 0 410.175 0H451.075C453.69 0 456.164 1.18677 457.801 3.22647L480.171 31.1058C483.618 35.4015 490.154 35.4089 493.61 31.121L516.109 3.21124C517.746 1.18059 520.214 0 522.823 0H563.734C570.953 0 574.976 8.33958 570.484 13.9898L523.142 73.5327C520.63 76.6914 520.645 81.1695 523.178 84.3113L570.293 142.757C574.84 148.398 570.825 156.792 563.579 156.792H521.127C518.498 156.792 516.013 155.593 514.377 153.535L493.704 127.535C490.252 123.193 483.657 123.193 480.205 127.535L459.532 153.535C457.896 155.593 455.411 156.792 452.783 156.792Z" />
    </svg>
  );
}

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
        {icon === 'nx' ? (
          <div
            className={classNames(
              'aspect-[582/314] shrink-0',
              iconClasses.lockup
            )}
          >
            <NxLockup />
          </div>
        ) : (
          <div className={classNames('shrink-0', iconClasses.icon)}>
            {icon && frameworkIcons[icon as Framework]?.image}
          </div>
        )}

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
