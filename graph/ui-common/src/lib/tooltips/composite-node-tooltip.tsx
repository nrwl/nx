import { ReactNode } from 'react';
import { Tag } from '../tag';

export interface CompositeNodeTooltipProps {
  id: string;
  compositeCount: number;
  projectCount: number;
  label: string;
  expanded: boolean;
  children?: ReactNode | ReactNode[];
}

export function CompositeNodeTooltip({
  children,
  label,
  compositeCount,
  projectCount,
}: CompositeNodeTooltipProps) {
  return (
    <div className="text-sm text-slate-700 dark:text-slate-400">
      <h4 className="flex items-center justify-between gap-4">
        <div className="flex items-center">
          <Tag className="mr-3">COMPOSITE</Tag>
          <span className="mr-3 font-mono">{label}</span>
        </div>
      </h4>

      <div>
        {compositeCount > 0 && (
          <p className="my-2 lowercase">
            <strong>Nested directories: </strong>
            {compositeCount}
          </p>
        )}
        {projectCount > 0 && (
          <p className="my-2">
            <strong>Projects: </strong>
            {projectCount}
          </p>
        )}
      </div>

      {children}
    </div>
  );
}
