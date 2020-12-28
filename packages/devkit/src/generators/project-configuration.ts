import { Tree } from '@nrwl/tao/src/shared/tree';
import {
  ProjectConfiguration,
  toNewFormat,
  WorkspaceConfiguration,
} from '@nrwl/tao/src/shared/workspace';
import { readJson } from '../utils/read-json';
import {
  NxJsonConfiguration,
  NxJsonProjectConfiguration,
} from '@nrwl/tao/src/shared/nx';
import { getWorkspacePath } from '../utils/get-workspace-layout';

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
  setProjectConfiguration(host, projectName, projectConfiguration, 'create');
}

/**
 * Updates the configuration of an existing project.
 *
 * The project configuration is stored in workspace.json and nx.json. The utility will update
 * both files.
 *
 * @param host - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 * @param projectConfiguration - project configuration
 */
export function updateProjectConfiguration(
  host: Tree,
  projectName: string,
  projectConfiguration: ProjectConfiguration & NxJsonProjectConfiguration
) {
  setProjectConfiguration(host, projectName, projectConfiguration, 'update');
}

/**
 * Reads a project configuration.
 *
 * The project configuration is stored in workspace.json and nx.json. The utility will read
 * both files.
 *
 * @param host - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 */
export function readProjectConfiguration(
  host: Tree,
  projectName: string
): ProjectConfiguration & NxJsonProjectConfiguration {
  return {
    ...readWorkspaceSection(host, projectName),
    nxJsonSection: readNxJsonSection(host, projectName),
  };
}

function readWorkspaceSection(host: Tree, projectName: string) {
  const path = getWorkspacePath(host);
  const workspaceJson = readJson<WorkspaceConfiguration>(host, path);
  const newFormat = toNewFormat(workspaceJson);

  if (!newFormat.projects[projectName]) {
    throw new Error(`Cannot find Project '${projectName}'`);
  }
  return newFormat.projects[projectName];
}

function readNxJsonSection(host: Tree, projectName: string) {
  const nxJson = readJson<NxJsonConfiguration>(host, 'nx.json');
  return nxJson.projects[projectName];
}

function setProjectConfiguration(
  host: Tree,
  projectName: string,
  projectConfiguration: ProjectConfiguration & NxJsonProjectConfiguration,
  mode: 'create' | 'update'
) {
  addProjectToWorkspaceJson(
    host,
    projectName,
    {
      ...projectConfiguration,
      tags: undefined,
      implicitDependencies: undefined,
    } as any,
    mode
  );
  addProjectToNxJson(host, projectName, {
    tags: projectConfiguration.tags,
    implicitDependencies: projectConfiguration.implicitDependencies,
  });
}

function addProjectToWorkspaceJson(
  host: Tree,
  projectName: string,
  project: ProjectConfiguration,
  mode: 'create' | 'update'
) {
  const path = getWorkspacePath(host);
  const workspaceJson = readJson<WorkspaceConfiguration>(host, path);
  if (mode == 'create' && workspaceJson.projects[projectName]) {
    throw new Error(
      `Cannot create Project '${projectName}'. It already exists.`
    );
  }
  if (mode == 'update' && !workspaceJson.projects[projectName]) {
    throw new Error(
      `Cannot update Project '${projectName}'. It does not exist.`
    );
  }
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
