import { VirtualElement } from '@popperjs/core';
import { ProjectNodeToolTipProps } from './project-node-tooltip';
import { EdgeNodeTooltipProps } from './edge-tooltip';

export class GraphTooltipService {
  private subscribers: Set<Function> = new Set();

  currentTooltip:
    | { ref: VirtualElement; type: 'node'; props: ProjectNodeToolTipProps }
    | { ref: VirtualElement; type: 'edge'; props: EdgeNodeTooltipProps };

  openProjectNodeToolTip(ref: VirtualElement, props: ProjectNodeToolTipProps) {
    this.currentTooltip = { type: 'node', ref, props };
    this.broadcastChange();
  }

  openEdgeToolTip(ref: VirtualElement, props: EdgeNodeTooltipProps) {
    this.currentTooltip = { type: 'edge', ref, props };
    this.broadcastChange();
  }

  broadcastChange() {
    this.subscribers.forEach((subscriber) => subscriber(this.currentTooltip));
  }

  subscribe(callback: Function) {
    this.subscribers.add(callback);

    return () => {
      this.subscribers.delete(callback);
    };
  }

  hideAll() {
    this.currentTooltip = null;
    this.broadcastChange();
  }
}

let tooltipService: GraphTooltipService;

export function getTooltipService(): GraphTooltipService {
  if (!tooltipService) {
    tooltipService = new GraphTooltipService();
  }

  return tooltipService;
}
