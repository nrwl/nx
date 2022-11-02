import { getGraphService } from './machines/graph.service';

import { VirtualElement } from '@popperjs/core';
import { ProjectNodeToolTipProps } from './project-node-tooltip';
import { EdgeNodeTooltipProps } from './edge-tooltip';
import { GraphInteractionEvents, GraphService } from '@nrwl/graph/ui-graph';

export class GraphTooltipService {
  private subscribers: Set<Function> = new Set();

  constructor(graph: GraphService) {
    graph.listen((event) => {
      switch (event.type) {
        case 'GraphRegenerated':
          this.hideAll();
          break;
        case 'NodeClick':
          this.openProjectNodeToolTip(event.ref, {
            id: event.data.id,
            tags: event.data.tags,
            type: event.data.type,
          });
          break;
        case 'EdgeClick':
          this.openEdgeToolTip(event.ref, {
            type: event.data.type,
            target: event.data.target,
            source: event.data.source,
            fileDependencies: event.data.fileDependencies,
          });
          break;
      }
    });
  }

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
    const graph = getGraphService();
    tooltipService = new GraphTooltipService(graph);
  }

  return tooltipService;
}
