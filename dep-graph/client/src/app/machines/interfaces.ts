// nx-ignore-next-line
import type {
  ProjectGraphDependency,
  ProjectGraphProjectNode,
} from '@nrwl/devkit';
import { ActionObject, ActorRef, State, StateNodeConfig } from 'xstate';

// The hierarchical (recursive) schema for the states
export interface DepGraphSchema {
  states: {
    idle: {};
    unselected: {};
    focused: {};
    textFiltered: {};
    customSelected: {};
  };
}

export interface GraphPerfReport {
  renderTime: number;
  numNodes: number;
  numEdges: number;
}
// The events that the machine handles

export type DepGraphUIEvents =
  | {
      type: 'setSelectedProjectsFromGraph';
      selectedProjectNames: string[];
      perfReport: GraphPerfReport;
    }
  | { type: 'selectProject'; projectName: string }
  | { type: 'deselectProject'; projectName: string }
  | { type: 'selectAll' }
  | { type: 'deselectAll' }
  | { type: 'selectAffected' }
  | { type: 'setGroupByFolder'; groupByFolder: boolean }
  | { type: 'setCollapseEdges'; collapseEdges: boolean }
  | { type: 'setIncludeProjectsByPath'; includeProjectsByPath: boolean }
  | { type: 'incrementSearchDepth' }
  | { type: 'decrementSearchDepth' }
  | { type: 'setSearchDepthEnabled'; searchDepthEnabled: boolean }
  | { type: 'setSearchDepth'; searchDepth: number }
  | { type: 'focusProject'; projectName: string }
  | { type: 'unfocusProject' }
  | { type: 'filterByText'; search: string }
  | { type: 'clearTextFilter' }
  | {
      type: 'initGraph';
      projects: ProjectGraphProjectNode[];
      dependencies: Record<string, ProjectGraphDependency[]>;
      affectedProjects: string[];
      workspaceLayout: {
        libsDir: string;
        appsDir: string;
      };
    }
  | {
      type: 'updateGraph';
      projects: ProjectGraphProjectNode[];
      dependencies: Record<string, ProjectGraphDependency[]>;
    };

// The events that the graph actor handles

export type GraphRenderEvents =
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
      type: 'notifyGraphShowProject';
      projectName: string;
    }
  | {
      type: 'notifyGraphHideProject';
      projectName: string;
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
    };

export type RouteEvents =
  | {
      type: 'notifyRouteFocusProject';
      focusedProject: string;
    }
  | {
      type: 'notifyRouteGroupByFolder';
      groupByFolder: boolean;
    }
  | {
      type: 'notifyRouteCollapseEdges';
      collapseEdges: boolean;
    }
  | {
      type: 'notifyRouteSearchDepth';
      searchDepthEnabled: boolean;
      searchDepth: number;
    }
  | {
      type: 'notifyRouteUnfocusProject';
    }
  | {
      type: 'notifyRouteSelectAll';
    }
  | {
      type: 'notifyRouteSelectAffected';
    }
  | { type: 'notifyRouteClearSelect' };

export type AllEvents = DepGraphUIEvents | GraphRenderEvents | RouteEvents;

// The context (extended state) of the machine
export interface DepGraphContext {
  projects: ProjectGraphProjectNode[];
  dependencies: Record<string, ProjectGraphDependency[]>;
  affectedProjects: string[];
  selectedProjects: string[];
  focusedProject: string | null;
  textFilter: string;
  includePath: boolean;
  searchDepth: number;
  searchDepthEnabled: boolean;
  groupByFolder: boolean;
  collapseEdges: boolean;
  workspaceLayout: {
    libsDir: string;
    appsDir: string;
  };
  graphActor: ActorRef<GraphRenderEvents>;
  routeSetterActor: ActorRef<RouteEvents>;
  routeListenerActor: ActorRef<DepGraphUIEvents>;
  lastPerfReport: GraphPerfReport;
}

export type DepGraphStateNodeConfig = StateNodeConfig<
  DepGraphContext,
  {},
  DepGraphUIEvents,
  ActionObject<DepGraphContext, DepGraphUIEvents>
>;

export type DepGraphSend = (
  event: DepGraphUIEvents | DepGraphUIEvents[]
) => void;

export type DepGraphState = State<
  DepGraphContext,
  DepGraphUIEvents,
  any,
  {
    value: any;
    context: DepGraphContext;
  }
>;
