import { Workspaces } from './workspaces';
import { workspaceRoot } from '../utils/workspace-root';
import { NxConfiguration } from './nx-json';
import { ProjectsConfigurations } from './workspace-json-project-json';

export function readNxJson(): NxConfiguration {
  return new Workspaces(workspaceRoot).readNxJson();
}

// TODO(v16): Remove this
/**
 * @deprecated Use readProjectsConfigurationFromProjectGraph(await createProjectGraphAsync())
 */
export function readAllWorkspaceConfiguration(): ProjectsConfigurations &
  NxConfiguration {
  return new Workspaces(workspaceRoot).readWorkspaceConfiguration();
}

/**
 * Returns information about where apps and libs will be created.
 */
export function workspaceLayout(): { appsDir: string; libsDir: string } {
  const nxConfig = readNxJson();
  return {
    appsDir: nxConfig.workspaceLayout?.appsDir ?? 'apps',
    libsDir: nxConfig.workspaceLayout?.libsDir ?? 'libs',
  };
}
