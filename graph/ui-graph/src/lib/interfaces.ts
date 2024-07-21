/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import {
  ProjectFileMap,
  ProjectGraphDependency,
  ProjectGraphProjectNode,
  TaskGraph,
} from '@nx/devkit';
/* eslint-enable @nx/enforce-module-boundaries */
import { VirtualElement } from '@floating-ui/react';
import {
  CompositeNodeTooltipProps,
  ProjectEdgeNodeTooltipProps,
  ProjectNodeToolTipProps,
  TaskNodeTooltipProps,
} from '@nx/graph/ui-tooltips';
import cytoscape, { Core, NodeCollection, NodeSingular } from 'cytoscape';

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
      fileMap: ProjectFileMap;
      dependencies: Record<string, ProjectGraphDependency[]>;
      affectedProjects: string[];
      workspaceLayout: {
        libsDir: string;
        appsDir: string;
      };
      groupByFolder: boolean;
      collapseEdges: boolean;
      composite: { enabled: boolean; context: string | null };
    }
  | {
      type: 'notifyGraphUpdateGraph';
      projects: ProjectGraphProjectNode[];
      fileMap: ProjectFileMap;
      dependencies: Record<string, ProjectGraphDependency[]>;
      affectedProjects: string[];
      workspaceLayout: {
        libsDir: string;
        appsDir: string;
      };
      groupByFolder: boolean;
      collapseEdges: boolean;
      selectedProjects: string[];
      composite: { enabled: boolean; context: string | null };
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
    }
  | { type: 'notifyGraphDisableCompositeGraph' }
  | { type: 'notifyGraphExpandCompositeNode'; id: string }
  | { type: 'notifyGraphCollapseCompositeNode'; id: string };

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
  | {
      ref: VirtualElement;
      type: 'compositeNode';
      props: CompositeNodeTooltipProps;
    }
  | { ref: VirtualElement; type: 'taskNode'; props: TaskNodeTooltipProps }
  | {
      ref: VirtualElement;
      type: 'projectEdge';
      props: ProjectEdgeNodeTooltipProps;
    };

export interface TraversalGraph {
  cy?: Core;

  setShownProjects(
    selectedProjectNames: string[]
  ): cytoscape.CollectionReturnValue;

  showProjects(
    selectedProjectNames: string[],
    alreadyShownProjects: string[]
  ): any;

  hideProjects(projectNames: string[], alreadyShownProjects: string[]): any;

  showAffectedProjects(): any;

  focusProject(focusedProjectName: string, searchDepth: number): any;

  showAllProjects(): any;

  hideAllProjects(): any;

  filterProjectsByText(
    search: string,
    includePath: boolean,
    searchDepth: number
  ): any;

  traceProjects(
    start: string,
    end: string
  ): cytoscape.Collection<
    cytoscape.SingularElementReturnValue,
    cytoscape.SingularElementArgument
  > &
    cytoscape.EdgeCollection &
    cytoscape.NodeCollection &
    cytoscape.EdgeSingular &
    cytoscape.NodeSingular;

  traceAllProjects(start: string, end: string): any;

  includeProjectsByDepth(
    projects: NodeCollection | NodeSingular,
    depth: number
  ): cytoscape.Collection<
    cytoscape.SingularElementReturnValue,
    cytoscape.SingularElementArgument
  > &
    cytoscape.EdgeCollection &
    cytoscape.NodeCollection &
    cytoscape.EdgeSingular &
    cytoscape.NodeSingular;

  initGraph(
    fileMap: ProjectFileMap,
    allProjects: ProjectGraphProjectNode[],
    workspaceLayout,
    dependencies: Record<string, ProjectGraphDependency[]>,
    affectedProjectIds: string[],
    collapseEdges: boolean,
    groupByFolder: boolean
  ): void;

  generateCytoscapeLayout(
    fileMap: ProjectFileMap,
    allProjects: ProjectGraphProjectNode[],
    groupByFolder: boolean,
    workspaceLayout,
    dependencies: Record<string, ProjectGraphDependency[]>,
    affectedProjectIds: string[]
  ): void;

  createElements(
    fileMap: ProjectFileMap,
    projects: ProjectGraphProjectNode[],
    groupByFolder: boolean,
    workspaceLayout: {
      appsDir: string;
      libsDir: string;
    },
    dependencies: Record<string, ProjectGraphDependency[]>,
    affectedProjectIds: string[]
  ): cytoscape.ElementDefinition[];
}
