import { cx } from '@nx/nx-dev/ui-primitives';
import { ReactNode } from 'react';

export function TerminalOutput({
  content,
  command,
  isMessageBelow,
  path,
}: {
  content: ReactNode;
  command: string;
  isMessageBelow: boolean;
  path: string;
}): JSX.Element {
  return (
    <div
      className={cx(
        'hljs not-prose w-full overflow-x-auto border border-slate-200 bg-slate-50/50 font-mono text-sm dark:border-slate-700 dark:bg-slate-800/60',
        isMessageBelow ? 'rounded-t-lg border-b-0' : 'rounded-lg'
      )}
    >
      <div className="relative flex justify-center border-b border-slate-200 bg-slate-100/50 p-2 text-slate-400 dark:border-slate-700 dark:bg-slate-700/50 dark:text-slate-500">
        <div className="absolute left-2 top-3 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-400 dark:bg-red-600" />
          <span className="h-2 w-2 rounded-full bg-yellow-400 dark:bg-yellow-600" />
          <span className="h-2 w-2 rounded-full bg-green-400 dark:bg-green-600" />
        </div>
        <span>Terminal</span>
      </div>
      <div className="overflow-x-auto p-4 pt-2">
        <div className="flex items-center">
          <p className="mt-0.5">
            <span className="text-purple-600 dark:text-fuchsia-500">
              {path}
            </span>
            <span className="mx-1 text-green-600 dark:text-green-400">❯</span>
          </p>
          <p className="typing mt-0.5 flex-1 pl-2">{command}</p>
        </div>
        <div className="not-prose mt-2 flex">{content}</div>
      </div>
    </div>
  );
}
