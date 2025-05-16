import type { ElementType, ReactElement } from 'react';
import type { MenuItem } from './menu-items';
import cx from 'classnames';
import Link from 'next/link';

export function MobileMenuItem({
  as = 'div',
  className = '',
  item,
  ...rest
}: {
  as?: ElementType;
  className?: string;
  item: MenuItem;
}): ReactElement {
  const hasExternalLink =
    item.href.startsWith('http') || item.href.startsWith('//');
  const Tag = as;
  return (
    <Tag
      className={cx(
        'items-top relative flex flex-1 gap-2 rounded-lg py-3',
        item.isHighlight ? 'bg-slate-50 px-2 dark:bg-slate-800/80' : '',
        className
      )}
      {...rest}
    >
      {item.icon ? (
        <item.icon aria-hidden="true" className="mt-1.5 size-4 shrink-0" />
      ) : null}
      <div className="grow">
        <Link
          href={item.href}
          title={item.name}
          target={hasExternalLink ? '_blank' : '_self'}
          className="text-sm font-medium text-slate-900 dark:text-slate-200"
          prefetch={false}
        >
          {item.name}
          {item.isNew ? (
            <span className="float-right inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-400/10 dark:text-sky-400 dark:ring-sky-400/30">
              new
            </span>
          ) : null}
          <span className="absolute inset-0" />
        </Link>
        {item.description ? (
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            {item.description}
          </p>
        ) : null}
      </div>
    </Tag>
  );
}
