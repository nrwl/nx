// nx-ignore-next-line
import type {
  ProjectGraphDependency,
  ProjectGraphProjectNode,
  TaskGraph,
} from '@nrwl/devkit';
import { VirtualElement } from '@floating-ui/react';
import {
  ProjectEdgeNodeTooltipProps,
  ProjectNodeToolTipProps,
  TaskNodeTooltipProps,
} from '@nrwl/graph/ui-tooltips';

export interface GraphPerfReport {
  renderTime: number;
  numNodes: number;
  numEdges: number;
}

export type TracingAlgorithmType = 'shortest' | 'all';

// The events that the graph actor handles

export type ProjectGraphRenderEvents =
  | {
      type: 'notifyGraphInitGraph';
      projects: ProjectGraphProjectNode[];
      dependencies: Record<string, ProjectGraphDependency[]>;
      affectedProjects: string[];
      workspaceLayout: {
        libsDir: string;
        appsDir: string;
      };
      groupByFolder: boolean;
      collapseEdges: boolean;
    }
  | {
      type: 'notifyGraphUpdateGraph';
      projects: ProjectGraphProjectNode[];
      dependencies: Record<string, ProjectGraphDependency[]>;
      affectedProjects: string[];
      workspaceLayout: {
        libsDir: string;
        appsDir: string;
      };
      groupByFolder: boolean;
      collapseEdges: boolean;
      selectedProjects: string[];
    }
  | {
      type: 'notifyGraphFocusProject';
      projectName: string;
      searchDepth: number;
    }
  | {
      type: 'notifyGraphShowProjects';
      projectNames: string[];
    }
  | {
      type: 'notifyGraphHideProjects';
      projectNames: string[];
    }
  | {
      type: 'notifyGraphShowAllProjects';
    }
  | {
      type: 'notifyGraphHideAllProjects';
    }
  | {
      type: 'notifyGraphShowAffectedProjects';
    }
  | {
      type: 'notifyGraphFilterProjectsByText';
      search: string;
      includeProjectsByPath: boolean;
      searchDepth: number;
    }
  | {
      type: 'notifyGraphTracing';
      start: string;
      end: string;
      algorithm: TracingAlgorithmType;
    };

export type TaskGraphRecord = Record<string, TaskGraph>;
export type TaskGraphRenderEvents =
  | {
      type: 'notifyTaskGraphSetProjects';
      projects: ProjectGraphProjectNode[];
      taskGraphs: TaskGraphRecord;
    }
  | {
      type: 'notifyTaskGraphTasksSelected';
      taskIds: string[];
    }
  | {
      type: 'notifyTaskGraphTasksDeselected';
      taskIds: string[];
    }
  | {
      type: 'setGroupByProject';
      groupByProject: boolean;
    }
  | { type: 'notifyTaskGraphSetTasks'; taskIds: string[] };

export type TooltipEvent =
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
