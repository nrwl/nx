import type { CompositeProjectNodeElementData } from '@nx/graph';
import { Tag, TooltipButton } from '@nx/graph-ui-common';

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
    <div className="flex max-w-[32rem] flex-col gap-4 rounded-md border border-black p-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
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
      <CompositeNodeContextMenuActions
        data={data}
        isExpanded={isExpanded}
        onAction={onAction}
      />
    </div>
  );
}

interface CompositeNodeContextMenuActionsProps {
  data: CompositeProjectNodeElementData;
  isExpanded: boolean;
  onAction: (action: {
    type: 'collapse-node' | 'expand-node' | 'change-selection' | 'exclude-node';
  }) => void;
}

function CompositeNodeContextMenuActions({
  isExpanded,
  onAction,
}: CompositeNodeContextMenuActionsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* TODO: (chau) re-enable focusing composite node */}
      {/* <TooltipButton */}
      {/*   onClick={() => */}
      {/*     onAction?.({ */}
      {/*       type: 'focus-node', */}
      {/*       rawId: id, */}
      {/*       id: encodedId, */}
      {/*       tooltipNodeType: 'compositeNode', */}
      {/*     }) */}
      {/*   } */}
      {/* > */}
      {/*   Focus */}
      {/* </TooltipButton> */}
      {isExpanded ? (
        <>
          <TooltipButton onClick={() => onAction({ type: 'collapse-node' })}>
            Collapse
          </TooltipButton>

          <TooltipButton onClick={() => onAction({ type: 'change-selection' })}>
            Change Selection
          </TooltipButton>
        </>
      ) : (
        <TooltipButton onClick={() => onAction({ type: 'expand-node' })}>
          Expand
        </TooltipButton>
      )}
      <TooltipButton onClick={() => onAction({ type: 'exclude-node' })}>
        Exclude
      </TooltipButton>
    </div>
  );
}
