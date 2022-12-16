/* eslint-disable-next-line */
import React, { ReactNode } from 'react';

export type TagProps = Partial<{
  className: string;
  children: ReactNode | ReactNode[];
}> &
  React.HTMLAttributes<HTMLSpanElement>;

export function Tag({ className, children, ...rest }: TagProps) {
  return (
    <span
      className={`${className} inline-block rounded-md bg-slate-300 p-2 font-sans text-xs font-semibold uppercase leading-4 tracking-wide text-slate-700`}
      {...rest}
    >
      {children}
    </span>
  );
}
