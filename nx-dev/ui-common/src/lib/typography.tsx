import { cx } from '@nx/nx-dev-ui-primitives';
import Link from 'next/link';
import { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

type AllowedVariants = 'title' | 'display' | 'subtitle';

type Headings = {
  as: ElementType;
  className?: string;
  children: ReactNode | ReactNode[];
  id?: string;
  variant: AllowedVariants;
};

type Description = {
  as: ElementType;
  className?: string;
  children: ReactNode | ReactNode[];
  id?: string;
};

const variants: Record<AllowedVariants, string> = {
  title:
    'text-3xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-5xl',
  display:
    'text-5xl font-semibold tracking-tight text-balance text-zinc-950 dark:text-white sm:text-7xl',
  subtitle:
    'text-lg font-medium text-pretty sm:text-xl/8 text-zinc-700 dark:text-zinc-300',
};

export function SectionHeading({
  as = 'div',
  children,
  className,
  variant,
  ...rest
}: Headings): JSX.Element {
  const Tag = as;
  return (
    <Tag className={cx(variants[variant], className)} {...rest}>
      {children}
    </Tag>
  );
}

export function SectionDescription({
  as = 'div',
  children,
  className,
  ...rest
}: Description): JSX.Element {
  const Tag = as;
  return (
    <Tag
      className={cx('text-zinc-700 dark:text-zinc-400', className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// TODO: add external link support with `<a>` only.
/**
 * Use `<Link>` from NextJs to create an internal link between screens.
 * Set `prefetch` to `false` by default.
 * @param className
 * @param props
 */
export function TextLink({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      prefetch={false}
      {...props}
      className={cx(
        className,
        'font-bold text-blue-600 underline decoration-blue-600/50 transition hover:text-black hover:decoration-blue-600 dark:text-blue-500 dark:decoration-blue-500/50 dark:hover:text-white dark:hover:decoration-blue-500'
      )}
    />
  );
}
export function TextLinkHighlight({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      {...props}
      className={cx(
        className,
        'rounded bg-black px-1 py-0.5 font-bold text-white transition hover:bg-blue-600 dark:bg-white dark:text-black dark:hover:bg-blue-500'
      )}
    />
  );
}

export function Strong({
  className,
  ...props
}: ComponentPropsWithoutRef<'strong'>) {
  return (
    <strong
      {...props}
      className={cx(className, 'font-bold text-zinc-950 dark:text-zinc-100')}
    />
  );
}

export function Code({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'code'>) {
  return (
    <code
      {...props}
      className={cx(
        className,
        'rounded border border-zinc-950/10 bg-zinc-950/[2.5%] px-0.5 text-sm font-medium text-zinc-950 sm:text-[0.8125rem] dark:border-white/20 dark:bg-white/5 dark:text-white'
      )}
    />
  );
}
