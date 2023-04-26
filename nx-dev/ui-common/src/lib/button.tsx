import Link from 'next/link';
import { cx } from '@nx/nx-dev/ui-primitives';
import {
  AnchorHTMLAttributes,
  ForwardedRef,
  forwardRef,
  ReactNode,
} from 'react';

type AllowedVariants = 'primary' | 'secondary';
type AllowedSizes = 'large' | 'default' | 'small';

interface ButtonProps {
  variant?: AllowedVariants;
  size?: AllowedSizes;
  children: ReactNode | ReactNode[];
}

const variantStyles: Record<AllowedVariants, string> = {
  primary:
    'bg-blue-500 dark:bg-sky-500 text-white group-hover:bg-blue-600 dark:group-hover:bg-sky-600 group-focus:ring-2 group-focus:ring-blue-500 dark:group-focus:ring-sky-500 focus:group-ring-offset-2',
  secondary:
    'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm group-hover:bg-slate-50 dark:group-hover:bg-slate-700 group-focus:ring-2 group-focus:ring-blue-500 dark:group-focus:ring-sky-500 focus:ring-offset-2',
};
const sizes: Record<AllowedSizes, string> = {
  large: 'space-x-4 px-4 py-2 text-lg',
  default: 'space-x-3 px-4 py-2 text-base',
  small: 'space-x-2 px-2.5 py-1.5 text-sm',
};

/**
 * Shared layout containing specific button styles.
 */
function getLayoutClassName({ className = '' }: { className: string }): string {
  return cx(
    'group relative inline-flex rounded border border-transparent shadow-sm font-medium opacity-100 focus:outline-none disabled:opacity-80 transition',
    className
  );
}

/**
 * This is the interior of the button that is properly styled.
 */
function ButtonInner({
  children,
  variant = 'primary',
  size = 'default',
}: ButtonProps): JSX.Element {
  return (
    <>
      <span
        className={cx(
          'flex h-full w-full items-center justify-center whitespace-nowrap rounded-md border border-transparent transition',
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
  variant = 'primary',
  size = 'large',
  ...props
}: ButtonProps & JSX.IntrinsicElements['button']): JSX.Element {
  return (
    <button {...props} className={getLayoutClassName({ className })}>
      <ButtonInner variant={variant} size={size}>
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
    variant = 'primary',
    title = '',
    ...props
  }: ButtonProps & {
    className?: string;
    href: string;
    title: string;
  } & AnchorHTMLAttributes<HTMLAnchorElement>,
  ref: ForwardedRef<HTMLAnchorElement>
): JSX.Element {
  return (
    <Link
      ref={ref}
      href={href}
      title={title}
      className={getLayoutClassName({ className })}
      {...props}
    >
      <ButtonInner variant={variant} size={size}>
        {children}
      </ButtonInner>
    </Link>
  );
});
