import { ReactNode } from 'react';

export function TerminalOutput({
  content,
  command,
}: {
  content: ReactNode;
  command: string;
}): JSX.Element {
  return (
    <div className="coding not-prose overflow-hidden rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs leading-normal subpixel-antialiased dark:border-slate-700 dark:bg-slate-800">
      <div className="relative flex justify-center border-b border-slate-200 bg-slate-100/50 p-2 text-slate-400 dark:border-slate-700 dark:bg-slate-700/50 dark:text-slate-500">
        <div className="absolute left-2 top-3 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-400 dark:bg-red-600" />
          <span className="h-2 w-2 rounded-full bg-yellow-400 dark:bg-yellow-600" />
          <span className="h-2 w-2 rounded-full bg-green-400 dark:bg-green-600" />
        </div>
        <span>Terminal</span>
      </div>
      <div className="p-4 pt-2">
        <div className="flex items-center">
          <p>
            <span className="text-base text-purple-600 dark:text-fuchsia-500">
              →
            </span>
            <span className="mx-1 text-green-600 dark:text-green-400">
              {' '}
              ~/workspace{' '}
            </span>
            <span>$</span>
          </p>
          <p className="typing mt-0.5 flex-1 pl-2">{command}</p>
        </div>
        <div className="not-prose mt-2 flex">{content}</div>
      </div>
    </div>
  );
}
