import Link from 'next/link';
import { ReactNode } from 'react';

export type PillProps = {
  url: string;
  children: ReactNode;
};

export function Pill({ url, children, ...rest }: PillProps): JSX.Element {
  return (
    <span className="not-content group relative mb-2 mr-2 inline-flex rounded-md border border-zinc-200 bg-zinc-50/40 text-sm shadow-sm transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 hover:bg-zinc-50 dark:border-zinc-800/40 dark:bg-zinc-800/60 dark:hover:bg-zinc-800">
      <span className="flex flex-col p-3">
        <Link
          href={url}
          className="flex items-center font-semibold no-underline group-hover:underline"
          prefetch={false}
        >
          <span className="absolute inset-0" aria-hidden="true"></span>
          {children}
        </Link>
      </span>
    </span>
  );
}
