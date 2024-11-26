import Link from 'next/link';
import { ReactNode } from 'react';

export function Pill({
  url,
  children,
}: {
  url: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <span className="group relative mb-2 mr-2 inline-flex rounded-md border border-slate-200 bg-slate-50/40 text-sm shadow-sm transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 hover:bg-slate-50 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:bg-slate-800">
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
