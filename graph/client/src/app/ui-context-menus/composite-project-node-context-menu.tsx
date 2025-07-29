import type { CompositeProjectNodeElementData } from '@nx/graph';
import { Tag, CompositeNodeTooltipActions } from '@nx/graph-ui-common';

export interface CompositeProjectNodeContextMenuProps {
  data: CompositeProjectNodeElementData;
  isExpanded: boolean;
  onAction: (action: {
    type: 'expand-node' | 'collapse-node' | 'change-selection' | 'exclude-node';
  }) => void;
}

export function CompositeProjectNodeContextMenu({
  data,
  isExpanded,
  onAction,
}: CompositeProjectNodeContextMenuProps) {
  return (
    <div className="flex max-w-[32rem] flex-col gap-4 rounded-md border border-black p-2">
      <div className="flex items-center gap-2">
        <Tag>Composite</Tag>
        <span className="font-mono">{data.label}</span>
      </div>

      <div className="flex flex-col gap-2">
        {data.compositeSize > 0 && (
          <p>
            <strong>Nested directories: </strong>
            {data.compositeSize}
          </p>
        )}
        {data.projectSize > 0 && (
          <p>
            <strong>Projects: </strong>
            {data.projectSize}
          </p>
        )}
      </div>
      <CompositeNodeTooltipActions
        {...data}
        compositeCount={data.compositeSize}
        projectCount={data.projectSize}
        expanded={isExpanded}
        onAction={onAction as any}
      />
    </div>
  );
}
