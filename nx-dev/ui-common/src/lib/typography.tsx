import cx from 'classnames';
import { ElementType, ReactNode } from 'react';

type AllowedVariants = 'title' | 'display';

type Headings = {
  as: ElementType;
  className?: string;
  children: ReactNode | ReactNode[];
  id?: string;
  variant: 'title' | 'display';
};

const variants: Record<AllowedVariants, string> = {
  title: 'text-lg font-semibold tracking-tight text-blue-500 dark:text-sky-500',
  display:
    'text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl',
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
