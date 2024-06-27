import { NxCloudIcon } from '@nx/graph/ui-icons';
import { twMerge } from 'tailwind-merge';

export interface AtomizerTooltipProps {
  connectedToCloud: boolean;
  nonAtomizedTarget: string;
  onNxConnect?: () => void;
}
export function AtomizerTooltip(props: AtomizerTooltipProps) {
  return (
    <div className="z-20 max-w-lg text-sm text-slate-700 dark:text-slate-400">
      <h4 className="flex items-center justify-between border-b border-slate-200 text-base dark:border-slate-700/60">
        <span className="font-mono">Atomizer</span>
      </h4>
      <div
        className={twMerge(
          'flex flex-col py-2 font-mono',
          !props.connectedToCloud
            ? 'border-b border-slate-200 dark:border-slate-700/60'
            : ''
        )}
      >
        <p className="whitespace-pre-wrap normal-case">
          {'Nx '}
          <Link
            href="https://nx.dev/ci/features/split-e2e-tasks"
            text="automatically split"
          />
          {' the potentially slow'}
          <code className="mx-2 rounded bg-gray-100 px-1 font-mono text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            {props.nonAtomizedTarget}
          </code>
          {'task into separate tasks for each file. Enable '}
          {!props.connectedToCloud ? (
            <Link href="https://nx.app/" text="Nx Cloud" />
          ) : (
            <Link
              href="https://nx.dev/ci/features/distribute-task-execution"
              text="Nx Agents"
            />
          )}
          {' to benefit from '}
          <Link
            href="https://nx.dev/ci/features/distribute-task-execution"
            text="task distribution"
          />
          {!props.connectedToCloud && (
            <>
              {', '}
              <Link
                href="https://nx.dev/ci/features/remote-cache"
                text="remote caching"
              />
            </>
          )}
          {' and '}
          <Link
            href="https://nx.dev/ci/features/flaky-tasks"
            text="flaky task re-runs"
          />
          . Use
          <code className="mx-2 rounded bg-gray-100 px-1 font-mono text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            {props.nonAtomizedTarget}
          </code>
          when running without{' '}
          {!props.connectedToCloud ? 'Nx Cloud' : 'Nx Agents'}.
        </p>
      </div>
      {!props.connectedToCloud && (
        <div className="flex py-2">
          <p className="pr-4 normal-case">
            {props.onNxConnect ? (
              <button
                className="inline-flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-base text-slate-600 ring-2 ring-inset ring-slate-400/40 hover:bg-slate-50 dark:text-slate-300 dark:ring-slate-400/30 dark:hover:bg-slate-800/60"
                onClick={() => props.onNxConnect!()}
              >
                <NxCloudIcon className="h-5 w-5 "></NxCloudIcon>
                <span>Connect to Nx Cloud</span>
              </button>
            ) : (
              <span className="font-mono">
                {'Run'}
                <code className="mx-2 rounded bg-gray-100 px-1 font-mono text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                  nx connect
                </code>
                {'to connect to Nx Cloud'}
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function Link({ href, text }: { href: string; text: string }) {
  return (
    <a
      href={href}
      className="inline text-slate-500 underline decoration-slate-700/50 decoration-dotted decoration-2 dark:text-slate-400 dark:decoration-slate-400/50"
      target="_blank"
      rel="noreferrer"
    >
      {text}
    </a>
  );
}
