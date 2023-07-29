import { useSyncExternalStore } from 'use-sync-external-store/shim';
import { getTooltipService } from '../machines/get-services';
import {
  ProjectEdgeNodeTooltip,
  ProjectNodeToolTip,
  TaskNodeTooltip,
  Tooltip,
} from '@nx/graph/ui-tooltips';
import { ProjectNodeActions } from './project-node-actions';

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
        tooltipToRender = (
          <ProjectNodeToolTip {...currentTooltip.props}>
            <ProjectNodeActions {...currentTooltip.props} />
          </ProjectNodeToolTip>
        );
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
      openAction="manual"
    ></Tooltip>
  ) : null;
}
