'use client';

import {
  ChevronDoubleUpIcon,
  ChevronDoubleDownIcon,
} from '@heroicons/react/24/outline';
import cx from 'classnames';
import { ReactNode, useState } from 'react';

const ui = {
  upIcon: (
    <ChevronDoubleUpIcon
      className="h-5 w-5 text-slate-500 dark:text-slate-300"
      aria-hidden="true"
    />
  ),
  downIcon: (
    <ChevronDoubleDownIcon
      className="h-5 w-5 text-slate-500 dark:text-slate-300"
      aria-hidden="true"
    />
  ),
  backgroundColor: 'bg-slate-50 dark:bg-slate-800/40',
  borderColor: 'ring-slate-100 dark:ring-slate-700',
  titleColor: 'text-slate-600 dark:text-slate-300',
  textColor: 'text-slate-700 dark:text-slate-400',
};

export function Disclosure({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(true);

  // We use `<span>`s because we are inside `<p>`s
  return (
    <span
      className={cx(
        'my-6 block flex-col rounded-md bg-slate-50 ring-1 ring-slate-100 dark:bg-slate-800/40 dark:ring-slate-700',
        ui.backgroundColor,
        ui.borderColor
      )}
    >
      <span
        onClick={() => setCollapsed(!collapsed)}
        className="flex flex-shrink-0 cursor-pointer p-4"
      >
        {collapsed ? ui.downIcon : ui.upIcon}
        <span className={cx('ml-3 block text-sm font-medium', ui.titleColor)}>
          {title}
        </span>
      </span>
      <span className={cx('block p-4 pl-12 pt-0', collapsed ? 'hidden' : '')}>
        <span className={cx('prose-sm block', ui.textColor)}>{children}</span>
      </span>
    </span>
  );
}
