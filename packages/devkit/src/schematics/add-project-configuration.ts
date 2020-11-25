import { Tree } from '@nrwl/tao/src/shared/tree';
import {
  ProjectConfiguration,
  WorkspaceConfiguration,
} from '@nrwl/tao/src/shared/workspace';
import { readJson } from '../utils/read-json';
import {
  NxJsonConfiguration,
  NxJsonProjectConfiguration,
} from '@nrwl/tao/src/shared/nx';

/**
 * Adds project configuration to the Nx workspace.
 *
 * The project configuration is stored in workspace.json and nx.json. The utility will update
 * both files.
 *
 * @param host - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 * @param projectConfiguration - project configuration
 */
export function addProjectConfiguration(
  host: Tree,
  projectName: string,
  projectConfiguration: ProjectConfiguration & NxJsonProjectConfiguration
) {
  addProjectToWorkspaceJson(host, projectName, {
    ...projectConfiguration,
    tags: undefined,
    implicitDependencies: undefined,
  } as any);
  addProjectToNxJson(host, projectName, {
    tags: projectConfiguration.tags,
    implicitDependencies: projectConfiguration.implicitDependencies,
  });
}

function addProjectToWorkspaceJson(
  host: Tree,
  projectName: string,
  project: ProjectConfiguration
) {
  const path = getWorkspacePath(host);
  const workspaceJson = readJson<WorkspaceConfiguration>(host, path);
  workspaceJson.projects[projectName] = project;
  host.write(path, JSON.stringify(workspaceJson));
}

function addProjectToNxJson(
  host: Tree,
  projectName: string,
  config: NxJsonProjectConfiguration
) {
  const nxJson = readJson<NxJsonConfiguration>(host, 'nx.json');
  nxJson.projects[projectName] = {
    ...{
      tags: [],
    },
    ...(config || {}),
  };
  host.write('nx.json', JSON.stringify(nxJson));
}

function getWorkspacePath(host: Tree) {
  const possibleFiles = ['/workspace.json', '/angular.json', '/.angular.json'];
  return possibleFiles.filter((path) => host.exists(path))[0];
}
