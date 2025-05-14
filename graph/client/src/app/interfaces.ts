/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type {
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
} from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */

export interface WorkspaceLayout {
  libsDir: string;
  appsDir: string;
}

export interface ProjectGraphService {
  getHash: () => Promise<string>;
  getProjectGraph: (url: string) => Promise<ProjectGraphClientResponse>;
  getTaskGraph: (url: string) => Promise<TaskGraphClientResponse>;
  setTaskInputsUrl?: (url: string) => void;
  getExpandedTaskInputs?: (taskId: string) => Promise<Record<string, string[]>>;
  getSourceMaps?: (
    url: string
  ) => Promise<Record<string, Record<string, string[]>>>;
}

export interface Environment {
  environment: 'dev' | 'watch' | 'release';
}

export interface GraphPerfReport {
  renderTime: number;
  numNodes: number;
  numEdges: number;
}

export interface CompositeNode {
  id: string;
  label: string;
  state: 'expanded' | 'collapsed' | 'hidden';
  parent?: string;
}
