import Tippy from '@tippyjs/react';
import ProjectNodeToolTip from './project-node-tooltip';
import EdgeNodeTooltip from './edge-tooltip';
import { selectValueByThemeStatic } from '../theme-resolver';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import { getTooltipService } from './tooltip-service';

const tooltipService = getTooltipService();

export function TooltipDisplay() {
  const currentTooltip = useSyncExternalStore(
    (callback) => tooltipService.subscribe(callback),
    () => tooltipService.currentTooltip
  );

  return currentTooltip ? (
    <Tippy
      content={
        currentTooltip.type === 'node' ? (
          <ProjectNodeToolTip {...currentTooltip.props}></ProjectNodeToolTip>
        ) : (
          <EdgeNodeTooltip {...currentTooltip.props}></EdgeNodeTooltip>
        )
      }
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
