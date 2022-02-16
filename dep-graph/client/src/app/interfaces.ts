// nx-ignore-next-line
import type { DepGraphClientResponse } from '@nrwl/workspace/src/command-line/dep-graph';

export interface ProjectGraphList {
  id: string;
  label: string;
  url: string;
}

export interface WorkspaceLayout {
  libsDir: string;
  appsDir: string;
}

export interface ProjectGraphService {
  getHash: () => Promise<string>;
  getProjectGraph: (url: string) => Promise<DepGraphClientResponse>;
}
export interface Environment {
  environment: 'dev' | 'watch' | 'release';
}

export interface AppConfig {
  showDebugger: boolean;
  showExperimentalFeatures: boolean;
  projectGraphs: ProjectGraphList[];
  defaultProjectGraph: string;
}
