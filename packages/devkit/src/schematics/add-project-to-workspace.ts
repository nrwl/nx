import { Tree } from '@nrwl/tao/src/shared/tree';
import {
  ProjectDefinition,
  WorkspaceDefinition,
} from '@nrwl/tao/src/shared/workspace';
import { readJson } from '../utils/read-json';
import { NxJsonProjectConfig, NxJson } from '@nrwl/tao/src/shared/nx';
import { getWorkspacePath } from '../utils/get-workspace-layout';

/**
 * Adds the configured project to the Nx workspace.
 * Updates both the workspace.json and nx.json.
 *
 * @param host
 * @param projectName
 * @param projectConfiguration
 * @param nxConfiguration
 */
export function addProjectToWorkspace(
  host: Tree,
  projectName: string,
  projectConfiguration: ProjectDefinition,
  nxConfiguration: NxJsonProjectConfig
) {
  addProjectToWorkspaceJson(host, projectName, projectConfiguration);
  addProjectToNxJson(host, projectName, nxConfiguration);
}

function addProjectToWorkspaceJson(
  host: Tree,
  projectName: string,
  projectConfiguration: ProjectDefinition
) {
  const path = getWorkspacePath(host);
  const workspaceJson = readJson<WorkspaceDefinition>(host, path);
  workspaceJson.projects[projectName] = projectConfiguration;
  host.write(path, JSON.stringify(workspaceJson));
}

function addProjectToNxJson(
  host: Tree,
  projectName: string,
  options: NxJsonProjectConfig
) {
  const defaultOptions = {
    tags: [],
  };

  const nxJson = readJson<NxJson>(host, 'nx.json');
  nxJson.projects[projectName] = { ...defaultOptions, ...options };
  host.write('nx.json', JSON.stringify(nxJson));
}
