import Tippy from '@tippyjs/react';
import ProjectNodeToolTip from './project-node-tooltip';
import ProjectEdgeNodeTooltip from './project-edge-tooltip';
import { selectValueByThemeStatic } from '../theme-resolver';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import { getTooltipService } from './tooltip-service';
import TaskNodeTooltip from './task-node-tooltip';

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
    <Tippy
      content={tooltipToRender}
      visible={true}
      getReferenceClientRect={currentTooltip.ref.getBoundingClientRect}
      theme={selectValueByThemeStatic('dark-nx', 'nx')}
      interactive={true}
      appendTo={document.body}
      maxWidth="none"
    ></Tippy>
  ) : null;
}

export default TooltipDisplay;
