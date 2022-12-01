import ProjectNodeToolTip from './project-node-tooltip';
import ProjectEdgeNodeTooltip from './project-edge-tooltip';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import { getTooltipService } from './tooltip-service';
import TaskNodeTooltip from './task-node-tooltip';
import { Tooltip } from './tooltip';

const tooltipService = getTooltipService();

export function TooltipDisplay() {
  const currentTooltip = useSyncExternalStore(
    (callback) => tooltipService.subscribe(callback),
    () => tooltipService.currentTooltip
  );
  let tooltipToRender;
  if (currentTooltip) {
    switch (currentTooltip.type) {
      case 'projectNode':
        tooltipToRender = <ProjectNodeToolTip {...currentTooltip.props} />;
        break;
      case 'projectEdge':
        tooltipToRender = <ProjectEdgeNodeTooltip {...currentTooltip.props} />;
        break;
      case 'taskNode':
        tooltipToRender = <TaskNodeTooltip {...currentTooltip.props} />;
        break;
    }
  }

  return tooltipToRender ? (
    <Tooltip
      content={tooltipToRender}
      open={true}
      reference={currentTooltip.ref}
      placement="top"
    ></Tooltip>
  ) : null;
}

export default TooltipDisplay;
