import Link from 'next/link';
import { cx } from '@nx/nx-dev-ui-primitives';
import {
  AnchorHTMLAttributes,
  ForwardedRef,
  forwardRef,
  ReactNode,
} from 'react';

type AllowedVariants = 'primary' | 'secondary' | 'contrast';
type AllowedSizes = 'large' | 'default' | 'small';

interface ButtonProps {
  variant?: AllowedVariants;
  size?: AllowedSizes;
  rounded?: 'full' | 'default';
  children: ReactNode | ReactNode[];
}

export type ButtonLinkProps = ButtonProps & {
  className?: string;
  href: string;
  title: string;
} & AnchorHTMLAttributes<HTMLAnchorElement>;

const variantStyles: Record<AllowedVariants, string> = {
  primary:
    'bg-blue-500 dark:bg-blue-500 text-white group-hover:bg-blue-600 dark:group-hover:bg-blue-600 group-focus:ring-2 group-focus:ring-blue-500 dark:group-focus:ring-blue-500 focus:group-ring-offset-2',
  secondary:
    'border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-700 group-focus:ring-2 group-focus:ring-blue-500 dark:group-focus:ring-blue-500 focus:ring-offset-2',
  contrast:
    'bg-zinc-950 dark:bg-white text-zinc-100 dark:text-zinc-950 group-hover:bg-zinc-800 dark:group-hover:bg-zinc-100 group-focus:ring-2 group-focus:ring-blue-500 dark:group-focus:ring-blue-500 focus:ring-offset-2',
};
const sizes: Record<AllowedSizes, string> = {
  large: 'space-x-4 px-4 py-2 text-lg',
  default: 'space-x-3 px-4 py-2 text-base',
  small: 'space-x-2 px-2.5 py-1.5 text-sm',
};

/**
 * Shared layout containing specific button styles.
 */
function getLayoutClassName(className = ''): string {
  return cx(
    'group relative inline-flex opacity-100 focus:outline-none disabled:opacity-80 disabled:cursor-not-allowed transition no-underline',
    className
  );
}

/**
 * This is the interior of the button that is properly styled.
 */
function ButtonInner({
  children,
  variant = 'contrast',
  size = 'default',
  rounded = 'default',
}: ButtonProps): JSX.Element {
  return (
    <>
      <span
        className={cx(
          'flex h-full w-full items-center justify-center whitespace-nowrap',
          rounded === 'full' ? 'rounded-full' : 'rounded-md',
          'border border-transparent font-medium shadow-sm transition',
          variantStyles[variant],
          sizes[size]
        )}
      >
        {children}
      </span>
    </>
  );
}

/**
 * Simple button that looks like a button.
 */
export function Button({
  children,
  className = '',
  variant = 'contrast',
  size = 'large',
  rounded = 'default',
  ...props
}: ButtonProps & JSX.IntrinsicElements['button']): JSX.Element {
  return (
    <button {...props} className={getLayoutClassName(className)}>
      <ButtonInner variant={variant} size={size} rounded={rounded}>
        {children}
      </ButtonInner>
    </button>
  );
}

/**
 * A link that looks like a button using Link from NextJS.
 */
export const ButtonLink = forwardRef(function (
  {
    children,
    className = '',
    href,
    size = 'default',
    variant = 'contrast',
    title = '',
    ...props
  }: ButtonLinkProps,
  ref: ForwardedRef<HTMLAnchorElement>
): JSX.Element {
  return (
    <Link
      ref={ref}
      href={href}
      title={title}
      className={getLayoutClassName(className)}
      prefetch={false}
      {...props}
    >
      <ButtonInner variant={variant} size={size}>
        {children}
      </ButtonInner>
    </Link>
  );
});
