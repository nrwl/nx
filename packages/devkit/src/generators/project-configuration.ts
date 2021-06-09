import type { Tree } from '@nrwl/tao/src/shared/tree';
import {
  ProjectConfiguration,
  RawWorkspaceJsonConfiguration,
  toNewFormat,
  WorkspaceJsonConfiguration,
} from '@nrwl/tao/src/shared/workspace';
import { readJson, updateJson, writeJson } from '../utils/json';
import type {
  NxJsonConfiguration,
  NxJsonProjectConfiguration,
} from '@nrwl/tao/src/shared/nx';
import { getWorkspacePath } from '../utils/get-workspace-layout';
import { join } from 'path';

export type WorkspaceConfiguration = Omit<
  WorkspaceJsonConfiguration,
  'projects'
> &
  Omit<NxJsonConfiguration, 'projects'>;

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
  projectConfiguration: ProjectConfiguration & NxJsonProjectConfiguration,
  standalone: boolean = false
): void {
  setProjectConfiguration(
    host,
    projectName,
    projectConfiguration,
    'create',
    standalone
  );
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
): void {
  setProjectConfiguration(host, projectName, projectConfiguration, 'update');
}

/**
 * Removes the configuration of an existing project.
 *
 * The project configuration is stored in workspace.json and nx.json.
 * The utility will update both files.
 */
export function removeProjectConfiguration(
  host: Tree,
  projectName: string
): void {
  setProjectConfiguration(host, projectName, undefined, 'delete');
}

/**
 * Get a map of all projects in a workspace.
 *
 * Use {@link readProjectConfiguration} if only one project is needed.
 */
export function getProjects(
  host: Tree
): Map<string, ProjectConfiguration & NxJsonProjectConfiguration> {
  const workspace = readWorkspace(host);
  const nxJson = readJson<NxJsonConfiguration>(host, 'nx.json');

  return new Map(
    Object.keys(workspace.projects).map((projectName) => {
      return [
        projectName,
        getProjectConfiguration(host, projectName, workspace, nxJson),
      ];
    })
  );
}

/**
 * Read general workspace configuration such as the default project or cli settings
 *
 * This does _not_ provide projects configuration, use {@link readProjectConfiguration} instead.
 */
export function readWorkspaceConfiguration(host: Tree): WorkspaceConfiguration {
  const workspace = readWorkspace(host);
  delete workspace.projects;
  const nxJson = readJson<NxJsonConfiguration>(host, 'nx.json');
  delete nxJson.projects;
  return {
    ...workspace,
    ...nxJson,
  };
}

/**
 * Update general workspace configuration such as the default project or cli settings.
 *
 * This does _not_ update projects configuration, use {@link updateProjectConfiguration} or {@link addProjectConfiguration} instead.
 */
export function updateWorkspaceConfiguration(
  host: Tree,
  workspaceConfig: WorkspaceConfiguration
): void {
  const { version, cli, defaultProject, generators, ...nxJson } =
    workspaceConfig;
  const workspace: Omit<Required<WorkspaceJsonConfiguration>, 'projects'> = {
    version,
    cli,
    defaultProject,
    generators,
  };

  updateJson<WorkspaceJsonConfiguration>(
    host,
    getWorkspacePath(host),
    (json) => {
      return { ...json, ...workspace };
    }
  );
  updateJson<NxJsonConfiguration>(host, 'nx.json', (json) => {
    return { ...json, ...nxJson };
  });
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
  const workspace = readWorkspace(host);
  if (!workspace.projects[projectName]) {
    throw new Error(
      `Cannot find configuration for '${projectName}' in ${getWorkspacePath(
        host
      )}.`
    );
  }

  const nxJson = readJson<NxJsonConfiguration>(host, 'nx.json');

  // TODO: Remove after confirming that nx.json should be optional.
  // if (!nxJson.projects[projectName]) {
  //   throw new Error(
  //     `Cannot find configuration for '${projectName}' in nx.json`
  //   );
  // }

  return getProjectConfiguration(host, projectName, workspace, nxJson);
}

function getProjectConfiguration(
  host: Tree,
  projectName: string,
  workspace: WorkspaceJsonConfiguration,
  nxJson: NxJsonConfiguration
): ProjectConfiguration & NxJsonProjectConfiguration {
  return {
    ...readWorkspaceSection(host, workspace, projectName),
    ...readNxJsonSection(nxJson, projectName),
  };
}

function readWorkspaceSection(
  host: Tree,
  workspace: WorkspaceJsonConfiguration,
  projectName: string
) {
  const config = workspace.projects[projectName];
  return config;
}

function readNxJsonSection(nxJson: NxJsonConfiguration, projectName: string) {
  return nxJson.projects[projectName];
}

function setProjectConfiguration(
  host: Tree,
  projectName: string,
  projectConfiguration: ProjectConfiguration & NxJsonProjectConfiguration,
  mode: 'create' | 'update' | 'delete',
  standalone: boolean = false
) {
  if (mode === 'delete') {
    addProjectToNxJson(host, projectName, undefined, mode);
    addProjectToWorkspaceJson(host, projectName, undefined, mode);
    return;
  }

  if (!projectConfiguration) {
    throw new Error(
      `Cannot ${mode} "${projectName}" with value ${projectConfiguration}`
    );
  }

  const { tags, implicitDependencies } = projectConfiguration;
  addProjectToWorkspaceJson(
    host,
    projectName,
    projectConfiguration,
    mode,
    standalone
  );
  addProjectToNxJson(
    host,
    projectName,
    {
      tags,
      implicitDependencies,
    },
    mode
  );
}

function addProjectToWorkspaceJson(
  host: Tree,
  projectName: string,
  project: ProjectConfiguration & NxJsonProjectConfiguration,
  mode: 'create' | 'update' | 'delete',
  standalone: boolean = false
) {
  const path = getWorkspacePath(host);
  const workspaceJson = readJson<RawWorkspaceJsonConfiguration>(host, path);

  validateWorkspaceJsonOperations(mode, workspaceJson, projectName);

  const configFile =
    mode === 'create' && standalone
      ? join(project.root, 'project.json')
      : getProjectFileLocation(host, projectName);

  if (configFile) {
    if (mode === 'delete') {
      host.delete(configFile);
    } else {
      writeJson(host, configFile, project);
    }

    if (mode === 'create') {
      workspaceJson.projects[projectName] = project.root;
      writeJson(host, path, workspaceJson);
    }
  } else {
    let workspaceConfiguration: ProjectConfiguration;
    if (project) {
      const { tags, implicitDependencies, ...c } = project;
      workspaceConfiguration = c;
    }

    workspaceJson.projects[projectName] = workspaceConfiguration;
    writeJson(host, path, workspaceJson);
  }
}

function addProjectToNxJson(
  host: Tree,
  projectName: string,
  config: NxJsonProjectConfiguration,
  mode: 'create' | 'update' | 'delete'
) {
  // distributed project files do not use nx.json,
  // so only proceed if the project does not use them.
  if (!getProjectFileLocation(host, projectName)) {
    const nxJson = readJson<NxJsonConfiguration>(host, 'nx.json');
    if (mode === 'delete') {
      delete nxJson.projects[projectName];
    } else {
      nxJson.projects[projectName] = {
        ...{
          tags: [],
        },
        ...(config || {}),
      };
    }
    writeJson(host, 'nx.json', nxJson);
  }
}

function readWorkspace(host: Tree): WorkspaceJsonConfiguration {
  const workspaceJson = inlineProjectConfigurationsWithTree(host);
  const originalVersion = workspaceJson.version;
  return {
    ...toNewFormat(workspaceJson),
    version: originalVersion,
  };
}

function inlineProjectConfigurationsWithTree(
  host: Tree
): WorkspaceJsonConfiguration {
  const path = getWorkspacePath(host);
  const workspaceJson = readJson<RawWorkspaceJsonConfiguration>(host, path);
  Object.entries(workspaceJson.projects).forEach(([project, config]) => {
    if (typeof config === 'string') {
      const configFileLocation = join(config, 'project.json');
      workspaceJson.projects[project] = readJson<
        ProjectConfiguration & NxJsonProjectConfiguration
      >(host, configFileLocation);
    }
  });
  return workspaceJson as WorkspaceJsonConfiguration;
}

/**
 * @description Determine where a project's configuration is located.
 * @returns file path if separate from root config, null otherwise.
 */
function getProjectFileLocation(host: Tree, project: string): string | null {
  const rawWorkspace = readJson<RawWorkspaceJsonConfiguration>(
    host,
    getWorkspacePath(host)
  );
  const projectConfig = rawWorkspace.projects[project];
  return typeof projectConfig === 'string'
    ? join(projectConfig, 'project.json')
    : null;
}

function validateWorkspaceJsonOperations(
  mode: 'create' | 'update' | 'delete',
  workspaceJson: RawWorkspaceJsonConfiguration | WorkspaceJsonConfiguration,
  projectName: string
) {
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
  if (mode == 'delete' && !workspaceJson.projects[projectName]) {
    throw new Error(
      `Cannot delete Project '${projectName}'. It does not exist.`
    );
  }
}
