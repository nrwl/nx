import { getGraphService } from '../machines/graph.service';

import { VirtualElement } from '@popperjs/core';
import { ProjectNodeToolTipProps } from './project-node-tooltip';
import { ProjectEdgeNodeTooltipProps } from './project-edge-tooltip';
import { GraphService } from '@nrwl/graph/ui-graph';
import { TaskNodeTooltipProps } from './task-node-tooltip';

export class GraphTooltipService {
  private subscribers: Set<Function> = new Set();

  constructor(graph: GraphService) {
    graph.listen((event) => {
      switch (event.type) {
        case 'GraphRegenerated':
          this.hideAll();
          break;
        case 'ProjectNodeClick':
          this.openProjectNodeToolTip(event.ref, {
            id: event.data.id,
            tags: event.data.tags,
            type: event.data.type,
          });
          break;
        case 'TaskNodeClick':
          this.openTaskNodeTooltip(event.ref, {
            ...event.data,
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
    | {
        ref: VirtualElement;
        type: 'projectNode';
        props: ProjectNodeToolTipProps;
      }
    | { ref: VirtualElement; type: 'taskNode'; props: TaskNodeTooltipProps }
    | {
        ref: VirtualElement;
        type: 'projectEdge';
        props: ProjectEdgeNodeTooltipProps;
      };

  openProjectNodeToolTip(ref: VirtualElement, props: ProjectNodeToolTipProps) {
    this.currentTooltip = { type: 'projectNode', ref, props };
    this.broadcastChange();
  }

  openTaskNodeTooltip(ref: VirtualElement, props: TaskNodeTooltipProps) {
    this.currentTooltip = { type: 'taskNode', ref, props };
    this.broadcastChange();
  }

  openEdgeToolTip(ref: VirtualElement, props: ProjectEdgeNodeTooltipProps) {
    this.currentTooltip = { type: 'projectEdge', ref, props };
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
