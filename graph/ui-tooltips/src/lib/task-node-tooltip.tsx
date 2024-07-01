import {
  DocumentMagnifyingGlassIcon,
  PencilSquareIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { Tag } from '@nx/graph/ui-components';
import { ReactNode } from 'react';

export interface TaskNodeTooltipProps {
  id: string;
  executor: string;
  runTaskCallback?: () => void;
  description?: string;
  inputs?: Record<string, string[]>;
  openConfigCallback?: () => void;
  renderMode?: 'nx-console' | 'nx-docs';
  children?: ReactNode | ReactNode[];
}

export function TaskNodeTooltip({
  id,
  executor,
  description,
  renderMode,
  runTaskCallback,
  openConfigCallback,
  children,
}: TaskNodeTooltipProps) {
  return (
    <div className="text-sm text-slate-700 dark:text-slate-400">
      <h4 className="mb-3 flex items-center justify-between gap-4">
        <div className="flex grow items-center justify-between">
          <div className="flex items-center">
            <Tag className="mr-3">{executor}</Tag>
            <span className="mr-3 font-mono">{id}</span>
          </div>
          {openConfigCallback && (
            <button
              className=" flex items-center rounded-md border-slate-300 bg-white p-1 font-medium text-slate-500 shadow-sm ring-1 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600 hover:dark:bg-slate-700"
              title={
                renderMode === 'nx-console'
                  ? 'Open project details in editor'
                  : 'Open project details'
              }
              onClick={openConfigCallback}
            >
              {renderMode === 'nx-console' ? (
                <PencilSquareIcon className="h-5 w-5" />
              ) : (
                <DocumentMagnifyingGlassIcon className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
        {runTaskCallback && (
          <button
            className=" flex items-center rounded-md border-slate-300 bg-white p-1 font-medium text-slate-500 shadow-sm ring-1 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600 hover:dark:bg-slate-700"
            title="Run Task"
            onClick={runTaskCallback}
          >
            <PlayIcon className="h-5 w-5" />
          </button>
        )}
      </h4>
      {description ? <p className="mt-4">{description}</p> : null}
      {children}
    </div>
  );
}
