import type { CompositeNodeTooltipProps } from '../composite-node-tooltip';
import { TooltipButton } from '../tooltip-button';
import type { NodeTooltipAction } from './tooltip-actions';

export interface CompositeNodeTooltipActionsProps
  extends CompositeNodeTooltipProps {
  onAction?: (action: NodeTooltipAction) => void;
  hasSelection?: boolean;
}

export function CompositeNodeTooltipActions({
  id,
  expanded,
  onAction,
  hasSelection = false,
}: CompositeNodeTooltipActionsProps) {
  const encodedId = encodeURIComponent(id);

  return (
    <div className="grid grid-cols-3 gap-4">
      <TooltipButton
        onClick={() =>
          onAction?.({
            type: 'focus-node',
            rawId: id,
            id: encodedId,
            tooltipNodeType: 'compositeNode',
          })
        }
      >
        Focus
      </TooltipButton>
      {expanded ? (
        <TooltipButton
          onClick={() =>
            onAction?.({
              type: 'collapse-node',
              rawId: id,
              id: encodedId,
              tooltipNodeType: 'compositeNode',
            })
          }
        >
          Collapse
        </TooltipButton>
      ) : (
        <TooltipButton
          onClick={() =>
            onAction?.({
              type: hasSelection ? 'expand-node' : 'select-and-expand-node',
              rawId: id,
              id: encodedId,
              tooltipNodeType: 'compositeNode',
            })
          }
        >
          {hasSelection ? 'Expand' : 'Select & Expand'}
        </TooltipButton>
      )}
      {expanded && hasSelection ? (
        <TooltipButton
          onClick={() =>
            onAction?.({
              type: 'change-selection',
              rawId: id,
              id: encodedId,
              tooltipNodeType: 'compositeNode',
            })
          }
        >
          Change Selection
        </TooltipButton>
      ) : (
        <TooltipButton
          onClick={() =>
            onAction?.({
              type: 'exclude-node',
              rawId: id,
              id: encodedId,
              tooltipNodeType: 'compositeNode',
            })
          }
        >
          Exclude
        </TooltipButton>
      )}
    </div>
  );
}
