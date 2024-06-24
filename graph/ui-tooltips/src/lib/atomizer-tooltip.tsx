import { twMerge } from 'tailwind-merge';
import { ExternalLink } from './external-link';

export interface AtomizerTooltipProps {
  isUsingCloud: boolean;
  nonAtomizedTarget: string;
}
export function AtomizerTooltip(props: AtomizerTooltipProps) {
  return (
    <div className="max-w-lg text-sm text-slate-700 dark:text-slate-400">
      <h4 className="flex items-center justify-between border-b border-slate-200 text-base dark:border-slate-700/60">
        <span className="font-mono">Atomizer</span>
      </h4>
      <div className="flex flex-col py-2 font-mono">
        <p className="flex grow items-center gap-2 whitespace-pre-wrap normal-case">
          Nx{' '}
          <ExternalLink href="https://nx.dev/ci/features/split-e2e-tasks">
            automatically split
          </ExternalLink>{' '}
          this potentially slow task into separate tasks for each file. We
          recommend enabling{' '}
          <ExternalLink href="https://nx.app/">Nx Cloud</ExternalLink> and{' '}
          <ExternalLink href="https://nx.dev/ci/features/distribute-task-execution">
            Nx Agents
          </ExternalLink>{' '}
          to benefit from{' '}
          <ExternalLink href="https://nx.dev/ci/features/distribute-task-execution">
            task distribution
          </ExternalLink>
          ,{' '}
          <ExternalLink href="https://nx.dev/ci/features/remote-cache">
            remote caching
          </ExternalLink>{' '}
          and{' '}
          <ExternalLink href="https://nx.dev/ci/features/flaky-tasks">
            flaky task re-runs
          </ExternalLink>
          . Use
          <code className="ml-4 inline rounded bg-gray-100 px-2 py-1 font-mono text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            {props.nonAtomizedTarget}
          </code>
          when running without Nx Agents.
        </p>
      </div>
    </div>
  );
}
