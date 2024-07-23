import { cx } from '@nx/nx-dev/ui-primitives';
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
    'text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-5xl',
  display:
    'text-5xl font-medium tracking-tight text-slate-950 md:text-6xl dark:text-white xl:text-8xl',
  subtitle: 'text-lg leading-8 text-slate-700 dark:text-slate-300 sm:text-2xl',
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
      className={cx('text-slate-700 dark:text-slate-400', className)}
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
        'font-bold text-blue-600 underline decoration-blue-600/50 transition hover:text-black hover:decoration-blue-600 dark:text-sky-500 dark:decoration-sky-500/50 dark:hover:text-white dark:hover:decoration-sky-500'
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
        'rounded bg-black px-1 py-0.5 font-bold text-white transition hover:bg-blue-600 dark:bg-white dark:text-black dark:hover:bg-sky-500'
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
      className={cx(className, 'font-bold text-slate-950 dark:text-slate-100')}
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
        'rounded border border-slate-950/10 bg-slate-950/[2.5%] px-0.5 text-sm font-medium text-slate-950 sm:text-[0.8125rem] dark:border-white/20 dark:bg-white/5 dark:text-white'
      )}
    />
  );
}
