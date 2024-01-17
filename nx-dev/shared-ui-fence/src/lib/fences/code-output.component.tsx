import { cx } from '@nx/nx-dev/ui-primitives';
import { ReactNode } from 'react';

export function CodeOutput({
  content,
  fileName,
  isMessageBelow,
}: {
  content: ReactNode;
  fileName: string;
  isMessageBelow: boolean;
}): JSX.Element {
  return (
    <div
      className={cx(
        'hljs not-prose w-full overflow-x-auto border border-slate-200 bg-slate-50/50 font-mono text-sm dark:border-slate-700 dark:bg-slate-800/60',
        isMessageBelow ? 'rounded-t-lg border-b-0' : 'rounded-lg'
      )}
    >
      {!!fileName && (
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 py-2 italic text-slate-400 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-500">
          {fileName}
        </div>
      )}
      <div className="p-4">{content}</div>
    </div>
  );
}
