import { Workspaces } from './workspaces';
import { workspaceRoot } from '../utils/workspace-root';
import { NxJsonConfiguration } from './nx-json';
import { ProjectsConfigurations } from './workspace-json-project-json';

export function readNxJson(): NxJsonConfiguration {
  return new Workspaces(workspaceRoot).readNxJson();
}

export function readAllWorkspaceConfiguration(): ProjectsConfigurations &
  NxJsonConfiguration {
  return new Workspaces(workspaceRoot).readWorkspaceConfiguration();
}

/**
 * Returns information about where apps and libs will be created.
 */
export function workspaceLayout(): { appsDir: string; libsDir: string } {
  const nxJson = readNxJson();
  return {
    appsDir: nxJson.workspaceLayout?.appsDir ?? 'apps',
    libsDir: nxJson.workspaceLayout?.libsDir ?? 'libs',
  };
}
