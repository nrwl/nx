import { cx } from '@nx/nx-dev/ui-primitives';
import { ElementType, ReactNode } from 'react';

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
    'text-3xl font-medium tracking-tight text-slate-950 dark:text-white sm:text-5xl',
  display:
    'text-4xl font-medium tracking-tight text-slate-950 dark:text-white sm:text-7xl',
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
