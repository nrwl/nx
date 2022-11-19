/* eslint-disable-next-line */
import { Link, LinkProps } from 'react-router-dom';
import { HTMLAttributes } from 'react';
import LinkWithSearchParams from '../ui-components/link-with-current-search-params';

const sharedClasses =
  'inline-flex items-center rounded-md border border-slate-300 bg-slate-50 py-2 px-4 mt-2 mr-2 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700';

export function TooltipButton({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${sharedClasses} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function TooltipLinkButton({
  to,
  className,
  children,
  ...rest
}: LinkProps) {
  return (
    <LinkWithSearchParams
      className={`${sharedClasses} ${className}`}
      to={to}
      {...rest}
    >
      {children}
    </LinkWithSearchParams>
  );
}
