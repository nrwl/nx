import { ProjectGraphDependency, ProjectGraphNode } from '@nrwl/devkit';
import { Observable } from 'rxjs';
import { ActionObject, ActorRef, StateNodeConfig, StateValue } from 'xstate';
import { GraphService } from '../graph';

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

// The events that the machine handles

export type DepGraphUIEvents =
  | { type: 'setSelectedProjectsFromGraph'; selectedProjectNames: string[] }
  | { type: 'selectProject'; projectName: string }
  | { type: 'deselectProject'; projectName: string }
  | { type: 'selectAll' }
  | { type: 'deselectAll' }
  | { type: 'selectAffected' }
  | { type: 'setGroupByFolder'; groupByFolder: boolean }
  | { type: 'setIncludeProjectsByPath'; includeProjectsByPath: boolean }
  | { type: 'incrementSearchDepth' }
  | { type: 'decrementSearchDepth' }
  | { type: 'setSearchDepthEnabled'; searchDepthEnabled: boolean }
  | { type: 'focusProject'; projectName: string }
  | { type: 'unfocusProject' }
  | { type: 'filterByText'; search: string }
  | { type: 'clearTextFilter' }
  | {
      type: 'initGraph';
      projects: ProjectGraphNode[];
      dependencies: Record<string, ProjectGraphDependency[]>;
      affectedProjects: string[];
      workspaceLayout: {
        libsDir: string;
        appsDir: string;
      };
    }
  | {
      type: 'updateGraph';
      projects: ProjectGraphNode[];
      dependencies: Record<string, ProjectGraphDependency[]>;
    };

// The events that the graph actor handles

export type GraphRenderEvents =
  | {
      type: 'notifyGraphInitGraph';
      projects: ProjectGraphNode[];
      dependencies: Record<string, ProjectGraphDependency[]>;
      affectedProjects: string[];
      workspaceLayout: {
        libsDir: string;
        appsDir: string;
      };
      groupByFolder: boolean;
    }
  | {
      type: 'notifyGraphUpdateGraph';
      projects: ProjectGraphNode[];
      dependencies: Record<string, ProjectGraphDependency[]>;
      affectedProjects: string[];
      workspaceLayout: {
        libsDir: string;
        appsDir: string;
      };
      groupByFolder: boolean;
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

export type AllEvents = DepGraphUIEvents | GraphRenderEvents;

// The context (extended state) of the machine
export interface DepGraphContext {
  projects: ProjectGraphNode[];
  dependencies: Record<string, ProjectGraphDependency[]>;
  affectedProjects: string[];
  selectedProjects: string[];
  focusedProject: string | null;
  textFilter: string;
  includePath: boolean;
  searchDepth: number;
  searchDepthEnabled: boolean;
  groupByFolder: boolean;
  workspaceLayout: {
    libsDir: string;
    appsDir: string;
  };
  graph: ActorRef<GraphRenderEvents>;
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
export type DepGraphStateObservable = Observable<{
  value: StateValue;
  context: DepGraphContext;
}>;
