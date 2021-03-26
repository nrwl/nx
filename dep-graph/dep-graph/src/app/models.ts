import { ProjectGraphCache } from '@nrwl/workspace';

export interface ProjectGraphList {
  id: string;
  label: string;
  graph: ProjectGraphCache;
  workspaceLayout: WorkspaceLayout;
}

export interface WorkspaceLayout {
  libsDir: string;
  appsDir: string;
}
