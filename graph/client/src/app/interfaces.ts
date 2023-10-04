/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type {
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
} from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */

export interface WorkspaceData {
  id: string;
  label: string;
  projectGraphUrl: string;
  taskGraphUrl: string;
}

export interface WorkspaceLayout {
  libsDir: string;
  appsDir: string;
}

export interface ProjectGraphService {
  getHash: () => Promise<string>;
  getProjectGraph: (url: string) => Promise<ProjectGraphClientResponse>;
  getTaskGraph: (url: string) => Promise<TaskGraphClientResponse>;
}

export interface Environment {
  environment: 'dev' | 'watch' | 'release';
}

export interface AppConfig {
  showDebugger: boolean;
  showExperimentalFeatures: boolean;
  workspaces: WorkspaceData[];
  defaultWorkspaceId: string;
}

export interface GraphPerfReport {
  renderTime: number;
  numNodes: number;
  numEdges: number;
}
