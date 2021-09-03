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
 * @param tree - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 * @param projectConfiguration - project configuration
 * @param standalone - should the project use package.json? If false, the project config is inside workspace.json
 */
export function addProjectConfiguration(
  tree: Tree,
  projectName: string,
  projectConfiguration: ProjectConfiguration & NxJsonProjectConfiguration,
  standalone: boolean = false
): void {
  standalone = standalone || getWorkspaceLayout(tree).standaloneAsDefault;
  setProjectConfiguration(
    tree,
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
 * @param tree - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 * @param projectConfiguration - project configuration
 */
export function updateProjectConfiguration(
  tree: Tree,
  projectName: string,
  projectConfiguration: ProjectConfiguration & NxJsonProjectConfiguration
): void {
  setProjectConfiguration(tree, projectName, projectConfiguration, 'update');
}

/**
 * Removes the configuration of an existing project.
 *
 * The project configuration is stored in workspace.json and nx.json.
 * The utility will update both files.
 */
export function removeProjectConfiguration(
  tree: Tree,
  projectName: string
): void {
  setProjectConfiguration(tree, projectName, undefined, 'delete');
}

/**
 * Get a map of all projects in a workspace.
 *
 * Use {@link readProjectConfiguration} if only one project is needed.
 */
export function getProjects(
  tree: Tree
): Map<string, ProjectConfiguration & NxJsonProjectConfiguration> {
  const workspace = readWorkspace(tree);
  const nxJson = readNxJson(tree);

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
export function readWorkspaceConfiguration(tree: Tree): WorkspaceConfiguration {
  const workspace = readWorkspace(tree);
  delete workspace.projects;

  let nxJson = readNxJson(tree);
  if (nxJson === null) {
    return workspace;
  }

  const nxJsonExtends = readNxJsonExtends(tree, nxJson as any);
  if (nxJsonExtends) {
    nxJson = { ...nxJsonExtends, ...nxJson };
  }

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
  tree: Tree,
  workspaceConfig: WorkspaceConfiguration
): void {
  const {
    // Workspace Json Properties
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
    tree,
    getWorkspacePath(tree),
    (json) => {
      return { ...json, ...workspace };
    }
  );

  if (tree.exists('nx.json')) {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      const nxJsonExtends = readNxJsonExtends(tree, json as any);
      if (nxJsonExtends) {
        const changedPropsOfNxJson = {};
        Object.keys(nxJson).forEach((prop) => {
          if (
            JSON.stringify(nxJson[prop], null, 2) !=
            JSON.stringify(nxJsonExtends[prop], null, 2)
          ) {
            changedPropsOfNxJson[prop] = nxJson[prop];
          }
        });
        return { ...json, ...changedPropsOfNxJson };
      } else {
        return { ...json, ...nxJson };
      }
    });
  }
}

function readNxJsonExtends(tree: Tree, nxJson: { extends?: string }) {
  if (nxJson.extends) {
    const extendsPath = nxJson.extends;
    try {
      return JSON.parse(
        tree.read(joinPathFragments('node_modules', extendsPath), 'utf-8')
      );
    } catch (e) {
      throw new Error(`Unable to resolve nx.json extends. Error: ${e.message}`);
    }
  } else {
    return null;
  }
}

/**
 * Reads a project configuration.
 *
 * The project configuration is stored in workspace.json and nx.json. The utility will read
 * both files.
 *
 * @param tree - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 * @throws If supplied projectName cannot be found
 */
export function readProjectConfiguration(
  tree: Tree,
  projectName: string
): ProjectConfiguration & NxJsonProjectConfiguration {
  const workspace = readWorkspace(tree);
  if (!workspace.projects[projectName]) {
    throw new Error(
      `Cannot find configuration for '${projectName}' in ${getWorkspacePath(
        tree
      )}.`
    );
  }

  const nxJson = readNxJson(tree);

  return getProjectConfiguration(projectName, workspace, nxJson);
}

export function readNxJson(tree: Tree): NxJsonConfiguration | null {
  if (!tree.exists('nx.json')) {
    return null;
  }
  let nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
  const nxJsonExtends = readNxJsonExtends(tree, nxJson as any);
  if (nxJsonExtends) {
    nxJson = { ...nxJsonExtends, ...nxJson };
  }
  return nxJson;
}

/**
 * Returns if a project has a standalone configuration (project.json).
 *
 * @param tree - the file system tree
 * @param project - the project name
 */
export function isStandaloneProject(tree: Tree, project: string): boolean {
  const rawWorkspace = readJson<RawWorkspaceJsonConfiguration>(
    tree,
    getWorkspacePath(tree)
  );
  const projectConfig = rawWorkspace.projects?.[project];

  return typeof projectConfig === 'string';
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
  return nxJson.projects?.[projectName];
}

function setProjectConfiguration(
  tree: Tree,
  projectName: string,
  projectConfiguration: ProjectConfiguration & NxJsonProjectConfiguration,
  mode: 'create' | 'update' | 'delete',
  standalone: boolean = false
): void {
  const hasNxJson = tree.exists('nx.json');

  if (mode === 'delete') {
    if (hasNxJson) {
      addProjectToNxJson(tree, projectName, undefined, mode);
    }
    addProjectToWorkspaceJson(tree, projectName, undefined, mode);
    return;
  }

  if (!projectConfiguration) {
    throw new Error(
      `Cannot ${mode} "${projectName}" with value ${projectConfiguration}`
    );
  }

  addProjectToWorkspaceJson(
    tree,
    projectName,
    projectConfiguration,
    mode,
    standalone
  );

  if (hasNxJson) {
    const { tags, implicitDependencies } = projectConfiguration;
    addProjectToNxJson(
      tree,
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
  tree: Tree,
  projectName: string,
  project: ProjectConfiguration & NxJsonProjectConfiguration,
  mode: 'create' | 'update' | 'delete',
  standalone: boolean = false
) {
  const path = getWorkspacePath(tree);
  const workspaceJson = readJson<RawWorkspaceJsonConfiguration>(tree, path);

  validateWorkspaceJsonOperations(mode, workspaceJson, projectName);

  const configFile =
    mode === 'create' && standalone
      ? joinPathFragments(project.root, 'project.json')
      : getProjectFileLocation(tree, projectName);

  if (configFile) {
    if (mode === 'delete') {
      tree.delete(configFile);
      delete workspaceJson.projects[projectName];
    } else {
      writeJson(tree, configFile, project);
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
  writeJson(tree, path, workspaceJson);
}

function addProjectToNxJson(
  tree: Tree,
  projectName: string,
  config: NxJsonProjectConfiguration,
  mode: 'create' | 'update' | 'delete'
) {
  // distributed project files do not use nx.json,
  // so only proceed if the project does not use them.
  if (!getProjectFileLocation(tree, projectName)) {
    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
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
    writeJson(tree, 'nx.json', nxJson);
  }
}

function readWorkspace(tree: Tree): WorkspaceJsonConfiguration {
  const workspaceJson = inlineProjectConfigurationsWithTree(tree);
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
  tree: Tree
): WorkspaceJsonConfiguration {
  const path = getWorkspacePath(tree);
  const workspaceJson = readJson<RawWorkspaceJsonConfiguration>(tree, path);
  Object.entries(workspaceJson.projects || {}).forEach(([project, config]) => {
    if (typeof config === 'string') {
      const configFileLocation = joinPathFragments(config, 'project.json');
      workspaceJson.projects[project] = readJson<
        ProjectConfiguration & NxJsonProjectConfiguration
      >(tree, configFileLocation);
    }
  });
  return workspaceJson as WorkspaceJsonConfiguration;
}

/**
 * @description Determine where a project's configuration is located.
 * @returns file path if separate from root config, null otherwise.
 */
function getProjectFileLocation(tree: Tree, project: string): string | null {
  const rawWorkspace = readJson<RawWorkspaceJsonConfiguration>(
    tree,
    getWorkspacePath(tree)
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
