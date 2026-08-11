import type { ReactNode } from 'react';

export type TagProps = Partial<{
  className: string;
  children: ReactNode | ReactNode[];
}> &
  React.HTMLAttributes<HTMLSpanElement>;

export function Tag({ className, children, ...rest }: TagProps) {
  return (
    <span
      className={`${className} inline-block rounded-md bg-slate-300 p-2 font-sans text-xs leading-4 font-semibold tracking-wide text-slate-700 uppercase`}
      {...rest}
    >
      {children}
    </span>
  );
}
