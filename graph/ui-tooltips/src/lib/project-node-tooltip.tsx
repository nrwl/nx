import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { Tag } from '@nx/graph/ui-components';
import { ReactNode } from 'react';

export interface ProjectNodeToolTipProps {
  type: 'app' | 'lib' | 'e2e';
  id: string;
  tags: string[];
  description?: string;
  openConfigCallback?: () => void;

  children?: ReactNode | ReactNode[];
}

export function ProjectNodeToolTip({
  type,
  id,
  tags,
  children,
  description,
  openConfigCallback,
}: ProjectNodeToolTipProps) {
  return (
    <div className="text-sm text-slate-700 dark:text-slate-400">
      <h4 className="flex justify-between items-center gap-4">
        <div className="flex items-center">
          <Tag className="mr-3">{type}</Tag>
          <span className="font-mono">{id}</span>
        </div>
        {openConfigCallback ? (
          <button
            className=" flex items-center rounded-md border-slate-300 bg-white p-1 font-medium text-slate-500 shadow-sm ring-1 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600 hover:dark:bg-slate-700"
            title="Edit project.json in editor"
            onClick={openConfigCallback}
          >
            <PencilSquareIcon className="h-5 w-5" />
          </button>
        ) : undefined}
      </h4>
      {tags.length > 0 ? (
        <p className="my-2">
          <strong>tags</strong>
          <br></br>
          {tags.join(', ')}
        </p>
      ) : null}
      {description ? <p className="mt-4">{description}</p> : null}
      {children}
    </div>
  );
}
