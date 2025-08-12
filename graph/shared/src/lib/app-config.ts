export interface AppConfig {
  showDebugger: boolean;
  showExperimentalFeatures: boolean;
  workspaces: WorkspaceData[];
  defaultWorkspaceId: string;
}

export interface WorkspaceData {
  id: string;
  label: string;
  projectGraphUrl: string;
  taskGraphUrl: string;
  taskInputsUrl: string;
  sourceMapsUrl: string;
}
