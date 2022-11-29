import { Workspaces } from './workspaces';
import { workspaceRoot } from '../utils/workspace-root';
import { NxConfig } from './nx-config';
import { ProjectsConfigurations } from './workspace-json-project-json';

export function readNxConfig(): NxConfig {
  return new Workspaces(workspaceRoot).readNxConfig();
}

// TODO(v16): Remove this
/**
 * @deprecated Use readProjectsConfigurationFromProjectGraph(await createProjectGraphAsync())
 */
export function readAllWorkspaceConfiguration(): ProjectsConfigurations &
  NxConfig {
  return new Workspaces(workspaceRoot).readWorkspaceConfiguration();
}

/**
 * Returns information about where apps and libs will be created.
 */
export function workspaceLayout(): { appsDir: string; libsDir: string } {
  const nxConfig = readNxConfig();
  return {
    appsDir: nxConfig.workspaceLayout?.appsDir ?? 'apps',
    libsDir: nxConfig.workspaceLayout?.libsDir ?? 'libs',
  };
}
