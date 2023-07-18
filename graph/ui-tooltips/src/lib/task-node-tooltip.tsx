import { Tag } from '@nx/graph/ui-components';
import { ReactNode } from 'react';

export interface TaskNodeTooltipProps {
  id: string;
  executor: string;
  description?: string;

  children?: ReactNode | ReactNode[];
}

export function TaskNodeTooltip({
  id,
  executor,
  description,
  children,
}: TaskNodeTooltipProps) {
  return (
    <div className="text-sm text-slate-700 dark:text-slate-400">
      <h4 className="mb-3">
        <Tag className="mr-3">{executor}</Tag>
        <span className="font-mono">{id}</span>
      </h4>
      {description ? <p className="mt-4">{description}</p> : null}
      {children}
    </div>
  );
}
