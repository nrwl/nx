/* eslint-disable-next-line */
import React, { ReactNode } from 'react';

export type DropdownProps = {
  children: ReactNode[];
} & React.HTMLAttributes<HTMLSelectElement>;

export function Dropdown(props: DropdownProps) {
  const { className, children, ...rest } = props;
  return (
    <select
      className={`flex items-center rounded-md rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700 ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}
