import type { HTMLAttributes, ReactNode } from 'react';

export type DropdownProps = {
  children: ReactNode[];
} & HTMLAttributes<HTMLSelectElement>;

export function Dropdown(props: DropdownProps) {
  const { className, children, ...rest } = props;
  return (
    <select
      className={`form-select flex items-center rounded-md border border-slate-300 bg-white py-2 pr-8 pl-4 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700 ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}
