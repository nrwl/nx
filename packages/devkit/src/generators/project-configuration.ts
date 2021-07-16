import {
  ProjectConfiguration,
  RawWorkspaceJsonConfiguration,
  toNewFormat,
  WorkspaceJsonConfiguration,
} from '@nrwl/tao/src/shared/workspace';

import {
  getWorkspaceLayout,
  getWorkspacePath,
} from '../utils/get-workspace-layout';
import { readJson, updateJson, writeJson } from '../utils/json';
import { joinPathFragments } from '../utils/path';

import type { Tree } from '@nrwl/tao/src/shared/tree';
import type {
  NxJsonConfiguration,
  NxJsonProjectConfiguration,
} from '@nrwl/tao/src/shared/nx';

export type WorkspaceConfiguration = Omit<
  WorkspaceJsonConfiguration,
  'projects'
> &
  Partial<Omit<NxJsonConfiguration, 'projects'>>;

/**
 * Adds project configuration to the Nx workspace.
 *
 * The project configuration is stored in workspace.json and nx.json. The utility will update
 * both files.
 *
 * @param host - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 * @param projectConfiguration - project configuration
 * @param standalone - should the project use package.json? If false, the project config is inside workspace.json
 */
export function addProjectConfiguration(
  host: Tree,
  projectName: string,
  projectConfiguration: ProjectConfiguration & NxJsonProjectConfiguration,
  standalone: boolean = false
): void {
  standalone = standalone || getWorkspaceLayout(host).standaloneAsDefault;
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
  setProjectConfiguration(
    host,
    projectName,
    projectConfiguration,
    'update',
    false
  );
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
  setProjectConfiguration(host, projectName, undefined, 'delete', false);
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
  const nxJson = readNxJson(host);

  return new Map(
    Object.keys(workspace.projects || {}).map((projectName) => {
      return [
        projectName,
        getProjectConfiguration(projectName, workspace, nxJson),
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

  const nxJson = readNxJson(host);
  if (nxJson !== null) {
    delete nxJson.projects;
  }

  return {
    ...workspace,
    ...(nxJson === null ? {} : nxJson),
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
  const {
    // Angular Json Properties
    version,
    cli,
    defaultProject,
    generators,

    // Nx Json Properties
    implicitDependencies,
    plugins,
    npmScope,
    targetDependencies,
    workspaceLayout,
    tasksRunnerOptions,
    affected,
  } = workspaceConfig;
  const workspace: Omit<Required<WorkspaceJsonConfiguration>, 'projects'> = {
    version,
    cli,
    defaultProject,
    generators,
  };
  const nxJson: Omit<Required<NxJsonConfiguration>, 'projects'> = {
    implicitDependencies,
    plugins,
    npmScope,
    targetDependencies,
    workspaceLayout,
    tasksRunnerOptions,
    affected,
  };

  updateJson<WorkspaceJsonConfiguration>(
    host,
    getWorkspacePath(host),
    (json) => {
      return { ...json, ...workspace };
    }
  );

  if (host.exists('nx.json')) {
    updateJson<NxJsonConfiguration>(host, 'nx.json', (json) => {
      return { ...json, ...nxJson };
    });
  }
}

/**
 * Reads a project configuration.
 *
 * The project configuration is stored in workspace.json and nx.json. The utility will read
 * both files.
 *
 * @param host - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 * @throws If supplied projectName cannot be found
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

  const nxJson = readNxJson(host);

  return getProjectConfiguration(projectName, workspace, nxJson);
}

export function readNxJson(host: Tree): NxJsonConfiguration | null {
  if (!host.exists('nx.json')) {
    return null;
  }
  return readJson<NxJsonConfiguration>(host, 'nx.json');
}

function getProjectConfiguration(
  projectName: string,
  workspace: WorkspaceJsonConfiguration,
  nxJson: NxJsonConfiguration | null
): ProjectConfiguration & NxJsonProjectConfiguration {
  return {
    ...readWorkspaceSection(workspace, projectName),
    ...(nxJson === null ? {} : readNxJsonSection(nxJson, projectName)),
  };
}

function readWorkspaceSection(
  workspace: WorkspaceJsonConfiguration,
  projectName: string
) {
  return workspace.projects[projectName];
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
): void {
  const hasNxJson = host.exists('nx.json');

  if (mode === 'delete') {
    if (hasNxJson) {
      addProjectToNxJson(host, projectName, undefined, mode);
    }
    addProjectToWorkspaceJson(host, projectName, undefined, mode);
    return;
  }

  if (!projectConfiguration) {
    throw new Error(
      `Cannot ${mode} "${projectName}" with value ${projectConfiguration}`
    );
  }

  addProjectToWorkspaceJson(
    host,
    projectName,
    projectConfiguration,
    mode,
    standalone
  );

  if (hasNxJson) {
    const { tags, implicitDependencies } = projectConfiguration;
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
      ? joinPathFragments(project.root, 'project.json')
      : getProjectFileLocation(host, projectName);

  if (configFile) {
    if (mode === 'delete') {
      host.delete(configFile);
      delete workspaceJson.projects[projectName];
    } else {
      writeJson(host, configFile, project);
    }
    if (mode === 'create') {
      workspaceJson.projects[projectName] = project.root;
    }
  } else {
    let workspaceConfiguration: ProjectConfiguration;
    if (project) {
      const { tags, implicitDependencies, ...c } = project;
      workspaceConfiguration = c;
    }
    workspaceJson.projects[projectName] = workspaceConfiguration;
  }
  writeJson(host, path, workspaceJson);
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

/**
 * This has to be separate from the inline functionality inside tao,
 * as the functionality in tao does not use a Tree. Changes made during
 * a generator would not be present during runtime execution.
 * @returns
 */
function inlineProjectConfigurationsWithTree(
  host: Tree
): WorkspaceJsonConfiguration {
  const path = getWorkspacePath(host);
  const workspaceJson = readJson<RawWorkspaceJsonConfiguration>(host, path);
  Object.entries(workspaceJson.projects || {}).forEach(([project, config]) => {
    if (typeof config === 'string') {
      const configFileLocation = joinPathFragments(config, 'project.json');
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
  const projectConfig = rawWorkspace.projects?.[project];
  return typeof projectConfig === 'string'
    ? joinPathFragments(projectConfig, 'project.json')
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
