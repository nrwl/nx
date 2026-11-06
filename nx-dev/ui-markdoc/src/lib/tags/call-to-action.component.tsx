import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { type Framework, frameworkIcons } from '@nx/graph-ui-icons';
import classNames from 'classnames';
import { useId } from 'react';

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

// The Nx Cloud app icon: Nx mark and "CLOUD" on a light tinted tile. The tile
// carries its own background, so it reads the same in light and dark mode.
function NxCloudLogo(): JSX.Element {
  const id = `nxc${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg
      role="img"
      className="h-full w-full"
      viewBox="0 0 831 831"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Nx Cloud</title>
      <defs>
        <clipPath id={`${id}-tile`}>
          <rect width="831" height="831" rx="193.8" />
        </clipPath>
        <linearGradient
          id={`${id}-base`}
          x1="415.5"
          y1="126.312"
          x2="605.799"
          y2="759.534"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FAFAFA" />
          <stop offset="1" stopColor="#F4F4F5" />
        </linearGradient>
        {[
          [
            'translate(-142.932 -91.41) rotate(13.687) scale(667.28 881.377)',
            '#E6DAFF',
          ],
          [
            'translate(811.887 521.868) rotate(-173.353) scale(222.542 293.945)',
            '#E6DAFF',
          ],
          ['translate(852.606 831) rotate(-150.866) scale(312.356)', '#9FE4EC'],
          [
            'translate(-158.721 174.51) rotate(40.025) scale(277.809)',
            '#9FE4EC',
          ],
        ].map(([transform, color], i) => (
          <radialGradient
            key={i}
            id={`${id}-tint${i}`}
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform={transform}
          >
            <stop stopColor={color} />
            <stop offset="0.4" stopColor={color} stopOpacity="0.8" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </radialGradient>
        ))}
        <linearGradient
          id={`${id}-nx`}
          x1="0"
          y1="35.4597"
          x2="0"
          y2="308.496"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#404044" />
          <stop offset="1" stopColor="#0C0C0D" />
        </linearGradient>
        <linearGradient
          id={`${id}-cloud`}
          x1="0"
          y1="356.777"
          x2="0"
          y2="465.111"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#404044" />
          <stop offset="1" stopColor="#0C0C0D" />
        </linearGradient>
        <filter
          id={`${id}-shadow`}
          x="-30%"
          y="-30%"
          width="160%"
          height="170%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="11.3258" />
          <feOffset dy="4.92028" />
          <feComponentTransfer result="s0">
            <feFuncA type="linear" slope="0.25" />
          </feComponentTransfer>
          <feGaussianBlur in="SourceAlpha" stdDeviation="20.19" />
          <feOffset dy="4.92028" />
          <feComponentTransfer result="s1">
            <feFuncA type="linear" slope="0.15" />
          </feComponentTransfer>
          <feOffset in="SourceAlpha" dy="4.92028" />
          <feComponentTransfer result="s2">
            <feFuncA type="linear" slope="0.15" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode in="s0" />
            <feMergeNode in="s1" />
            <feMergeNode in="s2" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g clipPath={`url(#${id}-tile)`}>
        <rect width="831" height="831" fill={`url(#${id}-base)`} />
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            width="831"
            height="831"
            fill={`url(#${id}-tint${i})`}
          />
        ))}
        <rect
          width="831"
          height="831"
          rx="193.8"
          stroke="black"
          strokeOpacity="0.05"
          strokeWidth="36"
        />
      </g>
      <g transform="scale(0.99828) translate(127.77 166)">
        <g filter={`url(#${id}-shadow)`}>
          <path
            d="M302.338 35.4609L362.357 35.4609C367.101 35.4609 370.653 39.8124 369.705 44.4631L326.212 257.914C320.214 287.35 294.335 308.496 264.307 308.496C239.327 308.496 216.692 293.77 206.559 270.926L159.727 165.338C156.795 158.726 147.129 159.686 145.553 166.746L115.222 302.628C114.457 306.057 111.415 308.496 107.903 308.496H47.8823C43.14 308.496 39.5882 304.147 40.5329 299.498L83.8782 86.157C89.8716 56.6579 115.798 35.4609 145.886 35.4609C170.9 35.4609 193.567 50.2043 203.718 73.0775L250.65 178.831C253.586 185.446 263.258 184.478 264.826 177.412L295.016 41.3383C295.778 37.9044 298.822 35.4609 302.338 35.4609Z"
            fill={`url(#${id}-nx)`}
          />
          <path
            d="M432.497 171.89H395.576C389.274 171.89 385.782 164.586 389.737 159.678L430.713 108.822C432.916 106.089 432.929 102.192 430.745 99.4434L389.571 47.6328C385.664 42.7163 389.163 35.4597 395.441 35.4597H431.012C433.286 35.4597 435.438 36.4923 436.861 38.2672L456.317 62.5261C459.315 66.2639 464.999 66.2704 468.006 62.5393L487.573 38.2539C488.997 36.487 491.144 35.4597 493.412 35.4597H528.994C535.272 35.4597 538.771 42.7163 534.864 47.6328L493.69 99.4434C491.505 102.192 491.519 106.089 493.721 108.822L534.698 159.678C538.653 164.586 535.161 171.89 528.859 171.89H491.937C489.651 171.89 487.49 170.847 486.067 169.057L468.088 146.433C465.085 142.655 459.35 142.655 456.347 146.433L438.368 169.057C436.945 170.847 434.783 171.89 432.497 171.89Z"
            fill={`url(#${id}-nx)`}
          />
          <path
            d="M94.3924 465.111C86.7574 465.111 79.6898 463.719 73.1898 460.933C66.6897 458.147 60.9635 454.278 56.0111 449.326C51.0586 444.373 47.1895 438.647 44.4038 432.147C41.7212 425.544 40.38 418.476 40.38 410.944C40.38 403.309 41.7212 396.242 44.4038 389.742C47.1895 383.242 51.0586 377.515 56.0111 372.563C60.9635 367.611 66.6897 363.741 73.1898 360.956C79.6898 358.17 86.7574 356.777 94.3924 356.777C100.377 356.777 106.206 357.809 111.881 359.872C117.555 361.936 122.611 364.876 127.047 368.694C130.254 371.391 132.947 374.499 135.124 378.02C136.676 380.531 135.598 383.734 133.026 385.182L124.097 390.209C121.364 391.748 117.948 390.737 115.946 388.322C113.967 385.934 111.683 383.931 109.095 382.313C104.968 379.631 99.7575 378.289 93.4638 378.289C89.1304 378.289 85.1066 379.115 81.3922 380.765C77.7811 382.313 74.6342 384.583 71.9517 387.575C69.2691 390.464 67.2056 393.92 65.7611 397.944C64.3167 401.865 63.5945 406.198 63.5945 410.944C63.5945 415.587 64.3167 419.921 65.7611 423.944C67.2056 427.968 69.2175 431.476 71.7969 434.468C74.4795 437.357 77.6779 439.627 81.3922 441.278C85.1066 442.826 89.1304 443.599 93.4638 443.599C99.7575 443.599 104.968 442.258 109.095 439.576C111.707 437.919 113.984 435.929 115.927 433.604C117.949 431.185 121.387 430.154 124.135 431.701L133.026 436.707C135.598 438.155 136.676 441.358 135.124 443.869C132.947 447.389 130.254 450.498 127.047 453.195C122.611 457.012 117.555 459.953 111.881 462.016C106.206 464.08 100.377 465.111 94.3924 465.111Z"
            fill={`url(#${id}-cloud)`}
          />
          <path
            d="M162.792 358.789C165.937 358.789 168.487 361.339 168.487 364.484V436.357C168.487 439.502 171.036 442.052 174.181 442.052H211.388C214.533 442.052 217.082 444.601 217.082 447.746V457.25C217.082 460.395 214.533 462.945 211.388 462.945H165.856C158.736 462.945 153.629 461.191 150.534 457.683C147.439 454.175 145.891 449.48 145.891 443.599V364.484C145.891 361.339 148.441 358.789 151.586 358.789H162.792Z"
            fill={`url(#${id}-cloud)`}
          />
          <path
            d="M270.409 464.957C262.774 464.957 255.655 463.615 249.052 460.933C242.448 458.25 236.671 454.484 231.718 449.635C226.869 444.683 223.051 438.905 220.266 432.302C217.583 425.698 216.242 418.579 216.242 410.944C216.242 403.309 217.583 396.19 220.266 389.587C223.051 382.984 226.869 377.257 231.718 372.408C236.671 367.559 242.448 363.793 249.052 361.111C255.655 358.325 262.774 356.932 270.409 356.932C278.147 356.932 285.266 358.325 291.766 361.111C298.37 363.793 304.147 367.559 309.1 372.408C314.052 377.257 317.87 382.984 320.552 389.587C323.338 396.19 324.731 403.309 324.731 410.944C324.731 418.579 323.338 425.698 320.552 432.302C317.87 438.905 314.052 444.683 309.1 449.635C304.147 454.484 298.37 458.25 291.766 460.933C285.266 463.615 278.147 464.957 270.409 464.957ZM270.409 443.599C274.742 443.599 278.766 442.774 282.481 441.123C286.298 439.472 289.6 437.151 292.385 434.159C295.274 431.167 297.493 427.71 299.04 423.79C300.588 419.766 301.362 415.484 301.362 410.944C301.362 406.301 300.588 402.02 299.04 398.099C297.493 394.178 295.274 390.722 292.385 387.73C289.6 384.738 286.298 382.416 282.481 380.765C278.766 379.115 274.742 378.289 270.409 378.289C266.076 378.289 262 379.115 258.183 380.765C254.468 382.416 251.167 384.738 248.278 387.73C245.492 390.722 243.325 394.178 241.778 398.099C240.23 402.02 239.456 406.301 239.456 410.944C239.456 415.484 240.23 419.766 241.778 423.79C243.325 427.71 245.492 431.167 248.278 434.159C251.167 437.151 254.468 439.472 258.183 441.123C262 442.774 266.076 443.599 270.409 443.599Z"
            fill={`url(#${id}-cloud)`}
          />
          <path
            d="M378.826 464.647C363.246 464.647 351.794 460.417 344.468 451.957C337.143 443.496 333.48 431.734 333.48 416.671V364.484C333.48 361.339 336.029 358.789 339.174 358.789H350.381C353.526 358.789 356.075 361.339 356.075 364.484V416.206C356.075 425.286 357.933 432.044 361.647 436.48C365.464 440.917 371.191 443.135 378.826 443.135C386.461 443.135 392.135 440.917 395.85 436.48C399.667 432.044 401.576 425.286 401.576 416.206V364.484C401.576 361.339 404.125 358.789 407.27 358.789H418.477C421.622 358.789 424.171 361.339 424.171 364.484V416.671C424.171 431.734 420.457 443.496 413.028 451.957C405.703 460.417 394.302 464.647 378.826 464.647Z"
            fill={`url(#${id}-cloud)`}
          />
          <path
            d="M536.75 410.944C536.75 418.889 535.357 426.06 532.571 432.456C529.785 438.853 525.813 444.322 520.654 448.861C515.599 453.401 509.614 456.909 502.702 459.385C495.892 461.758 488.36 462.945 480.106 462.945H447.419C444.274 462.945 441.725 460.395 441.725 457.25V364.484C441.725 361.339 444.274 358.789 447.419 358.789H480.57C491.817 358.789 501.618 360.956 509.976 365.289C518.436 369.623 524.988 375.71 529.63 383.551C534.377 391.289 536.75 400.42 536.75 410.944ZM513.535 410.944C513.535 404.651 512.142 399.182 509.356 394.539C506.674 389.896 502.856 386.285 497.904 383.706C492.952 381.023 487.174 379.682 480.57 379.682H470.015C466.87 379.682 464.32 382.232 464.32 385.377V436.976C464.32 440.121 466.87 442.671 470.015 442.671H480.106C485.059 442.671 489.547 441.949 493.571 440.504C497.594 438.956 501.102 436.841 504.094 434.159C507.19 431.373 509.511 428.02 511.059 424.099C512.71 420.179 513.535 415.794 513.535 410.944Z"
            fill={`url(#${id}-cloud)`}
          />
        </g>
      </g>
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
            {icon === 'nxcloud' ? (
              <NxCloudLogo />
            ) : (
              icon && frameworkIcons[icon as Framework]?.image
            )}
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
