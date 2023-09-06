import { PlayIcon } from '@heroicons/react/24/outline';
import { Tag } from '@nx/graph/ui-components';

export interface TaskNodeTooltipProps {
  id: string;
  executor: string;
  runTaskCallback?: () => void;
  description?: string;
}

export function TaskNodeTooltip({
  id,
  executor,
  description,
  runTaskCallback: runTargetCallback,
}: TaskNodeTooltipProps) {
  return (
    <div className="text-sm text-slate-700 dark:text-slate-400">
      <h4 className="flex justify-between items-center gap-4">
        <div className="flex items-center">
          <Tag className="mr-3">{executor}</Tag>
          <span className="font-mono">{id}</span>
        </div>
        {runTargetCallback ? (
          <button
            className=" flex items-center rounded-md border-slate-300 bg-white p-1 font-medium text-slate-500 shadow-sm ring-1 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600 hover:dark:bg-slate-700"
            title="Run Task"
            onClick={runTargetCallback}
          >
            <PlayIcon className="h-5 w-5" />
          </button>
        ) : undefined}
      </h4>
      <h4></h4>
      {description ? <p className="mt-4">{description}</p> : null}
    </div>
  );
}
