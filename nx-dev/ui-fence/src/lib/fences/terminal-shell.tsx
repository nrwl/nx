import { JSX, ReactNode } from 'react';

export function TerminalShellWrapper({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="hljs not-prose w-full overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/50 font-mono text-sm dark:border-slate-700 dark:bg-slate-800/60">
      <div className="relative flex justify-center border-b border-slate-200 bg-slate-100/50 p-2 text-slate-400 dark:border-slate-700 dark:bg-slate-700/50 dark:text-slate-500">
        <div className="absolute left-2 top-3 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-400 dark:bg-red-600" />
          <span className="h-2 w-2 rounded-full bg-yellow-400 dark:bg-yellow-600" />
          <span className="h-2 w-2 rounded-full bg-green-400 dark:bg-green-600" />
        </div>
        <span className="h-5">{title}</span>
      </div>
      {children}
    </div>
  );
}
