import { cx } from '@nx/nx-dev/ui-primitives';
import { ReactNode } from 'react';
import { VideoLoop } from '../../tags/video-loop.component';

export function TerminalOutput({
  content,
  command,
  isMessageBelow,
  path,
}: {
  content: ReactNode | null;
  command: string;
  isMessageBelow: boolean;
  path: string;
}): JSX.Element {
  const isVideo = command.indexOf('.mp4') > -1;

  return (
    <div
      className={cx(
        'hljs not-prose w-full overflow-x-auto border border-slate-200 bg-slate-50/50 font-mono text-sm dark:border-slate-700 dark:bg-slate-800/60',
        isMessageBelow ? 'rounded-t-lg border-b-0' : 'rounded-lg'
      )}
    >
      <div className="relative flex justify-center p-2 border-b border-slate-200 bg-slate-100/50 text-slate-400 dark:border-slate-700 dark:bg-slate-700/50 dark:text-slate-500">
        <div className="absolute flex items-center gap-2 left-2 top-3">
          <span className="w-2 h-2 bg-red-400 rounded-full dark:bg-red-600" />
          <span className="w-2 h-2 bg-yellow-400 rounded-full dark:bg-yellow-600" />
          <span className="w-2 h-2 bg-green-400 rounded-full dark:bg-green-600" />
        </div>
        <span className="h-5"></span>
      </div>
      {!isVideo && (
        <div className="p-4 pt-2 overflow-x-auto">
          <div className="flex items-center">
            <p className="mt-0.5">
              {path && (
                <span className="text-purple-600 dark:text-fuchsia-500">
                  {path}
                </span>
              )}
              <span className="mx-1 text-green-600 dark:text-green-400">❯</span>
            </p>
            <p className="typing mt-0.5 flex-1 pl-2">{command}</p>
          </div>
          <div className="flex not-prose">{content}</div>
        </div>
      )}
      {isVideo && (
        <div className="overflow-x-auto">
          <VideoLoop src={command}></VideoLoop>
        </div>
      )}
    </div>
  );
}
