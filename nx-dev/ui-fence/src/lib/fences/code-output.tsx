import { JSX, ReactNode } from 'react';
import cx from 'classnames';

export function CodeOutput({
  content,
  fileName,
  isWithinTab,
}: {
  content: ReactNode;
  fileName: string;
  isWithinTab?: boolean;
}): JSX.Element {
  return (
    <div
      className={cx(
        'hljs not-prose w-full overflow-x-auto border-zinc-200 bg-zinc-50/50 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-800/60',
        isWithinTab ? 'border-b border-t' : 'rounded-lg border'
      )}
    >
      {!!fileName && (
        <div className="flex border-b border-zinc-200 bg-zinc-50 px-4 py-2 italic text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-500">
          {fileName}
        </div>
      )}
      <div className="p-4">{content}</div>
    </div>
  );
}
