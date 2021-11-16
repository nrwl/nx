import { ProjectGraphDependency, ProjectGraphNode } from '@nrwl/devkit';
import { Observable } from 'rxjs';
import { ActionObject, StateNodeConfig, StateValue } from 'xstate';

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
export type DepGraphEvents =
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
}

export type DepGraphStateNodeConfig = StateNodeConfig<
  DepGraphContext,
  {},
  DepGraphEvents,
  ActionObject<DepGraphContext, DepGraphEvents>
>;

export type DepGraphSend = (event: DepGraphEvents | DepGraphEvents[]) => void;
export type DepGraphStateObservable = Observable<{
  value: StateValue;
  context: DepGraphContext;
}>;
