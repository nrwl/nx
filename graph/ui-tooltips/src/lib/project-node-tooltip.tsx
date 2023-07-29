import { Tag } from '@nx/graph/ui-components';
import { ReactNode } from 'react';

export interface ProjectNodeToolTipProps {
  type: 'app' | 'lib' | 'e2e';
  id: string;
  tags: string[];
  description?: string;

  children?: ReactNode | ReactNode[];
}

export function ProjectNodeToolTip({
  type,
  id,
  tags,
  children,
  description,
}: ProjectNodeToolTipProps) {
  return (
    <div className="text-sm text-slate-700 dark:text-slate-400">
      <h4>
        <Tag className="mr-3">{type}</Tag>
        <span className="font-mono">{id}</span>
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
