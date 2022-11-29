import { basename, dirname, join, relative } from 'path';
import type { NxConfig } from '../../config/nx-config';
import {
  ProjectConfiguration,
  RawProjectsConfigurations,
  ProjectsConfigurations,
} from '../../config/workspace-config-project-config';
import {
  buildWorkspaceConfigurationFromGlobs,
  deduplicateProjectFiles,
  globForProjectFiles,
  reformattedWorkspaceJsonOrNull,
  toNewFormat,
} from '../../config/workspaces';
import { PackageJson } from '../../utils/package-json';
import { joinPathFragments, normalizePath } from '../../utils/path';

import type { Tree } from '../tree';

import { readJson, updateJson, writeJson } from './json';
import { readYaml, updateYaml, writeYaml } from './yaml';

const fileHandlers = {
  json: {
    read: readJson,
    update: updateJson,
    write: writeJson,
  },
  yaml: {
    read: readYaml,
    update: updateYaml,
    write: writeYaml,
  },
};

export type WorkspaceConfiguration = Omit<ProjectsConfigurations, 'projects'> &
  Partial<NxConfig>;

/**
 * Adds project configuration to the Nx workspace.
 *
 * The project configuration is stored in workspace.* or the associated project.* file.
 * The utility will update either files.
 *
 * @param tree - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 * @param projectConfiguration - project configuration
 * @param standalone - should the project use package.json? If false, the project config is inside workspace.json
 */
export function addProjectConfiguration(
  tree: Tree,
  projectName: string,
  projectConfiguration: ProjectConfiguration,
  standalone?: boolean
): void {
  standalone = standalone ?? shouldDefaultToUsingStandaloneConfigs(tree);
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
 * The project configuration is stored in workspace.* or the associated project.* file.
 * The utility will update either files.
 *
 * @param tree - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 * @param projectConfiguration - project configuration
 */
export function updateProjectConfiguration(
  tree: Tree,
  projectName: string,
  projectConfiguration: ProjectConfiguration
): void {
  setProjectConfiguration(tree, projectName, projectConfiguration, 'update');
}

/**
 * Removes the configuration of an existing project.
 *
 * The project configuration is stored in workspace.* or the associated project.* file.
 * The utility will update either file.
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
export function getProjects(tree: Tree): Map<string, ProjectConfiguration> {
  const workspace = readWorkspace(tree);

  return new Map(
    Object.keys(workspace.projects || {}).map((projectName) => {
      return [projectName, getProjectConfiguration(projectName, workspace)];
    })
  );
}

/**
 * Read general workspace configuration such as the default project or cli settings
 *
 * This does _not_ provide projects configuration, use {@link readProjectConfiguration} instead.
 */
export function readWorkspaceConfiguration(tree: Tree): WorkspaceConfiguration {
  const { projects, ...workspace } = readRawWorkspaceConfig(tree); // Create a new object, without projects

  let nxConfig = readNxConfig(tree);
  if (nxConfig === null) {
    return workspace;
  }

  return {
    ...workspace,
    ...nxConfig,
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
    // Nx Config Properties
    cli,
    defaultProject,
    generators,
    implicitDependencies,
    plugins,
    pluginsConfig,
    npmScope,
    namedInputs,
    targetDefaults,
    targetDependencies,
    workspaceLayout,
    tasksRunnerOptions,
    affected,
    extends: ext,
  } = workspaceConfig;

  const nxConfig: Required<NxConfig> = {
    implicitDependencies,
    plugins,
    pluginsConfig,
    npmScope,
    namedInputs,
    targetDefaults,
    targetDependencies,
    workspaceLayout,
    tasksRunnerOptions,
    affected,
    cli,
    generators,
    defaultProject,
    extends: ext,
  };

  if (tree.exists('nx.json')) {
    updateJson<NxConfig>(tree, 'nx.json', (config) => {
      if (config.extends) {
        const nxJsonExtends = readNxConfigExtends(tree, config.extends);
        const changedPropsOfNxJson = {};
        Object.keys(nxConfig).forEach((prop) => {
          if (
            JSON.stringify(nxConfig[prop], null, 2) !=
            JSON.stringify(nxJsonExtends[prop], null, 2)
          ) {
            changedPropsOfNxJson[prop] = nxConfig[prop];
          }
        });
        return { ...config, ...changedPropsOfNxJson };
      } else {
        return { ...config, ...nxConfig };
      }
    });
  }

  // Only prop in workspace.json is version. If there is no
  // workspace.json file, this f(x) doesn't update anything
  // in project config.
  const workspacePath = getWorkspacePath(tree);
  if (workspacePath) {
    updateJson<ProjectsConfigurations>(tree, workspacePath, (config) => {
      config = {
        ...config,
        version: workspaceConfig.version,
      };
      if (!(workspaceConfig as any).newProjectRoot) {
        delete (config as any).newProjectRoot;
      }
      return config;
    });
  }
}

function readNxConfigExtends(tree: Tree, extendsPath: string) {
  const extension = extendsPath.split('.').slice(-1)[0] || 'json';
  try {
    return fileHandlers[extension].read(
      tree,
      relative(
        tree.root,
        require.resolve(extendsPath, {
          paths: [tree.root],
        })
      )
    );
  } catch (e) {
    throw new Error(`Unable to resolve nx.json extends. Error: ${e.message}`);
  }
}

/**
 * Reads a project configuration.
 *
 * The project configuration is stored in workspace.* or the associated project.* file.
 * The utility will read from either file.
 *
 * @param tree - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 * @throws If supplied projectName cannot be found
 */
export function readProjectConfiguration(
  tree: Tree,
  projectName: string
): ProjectConfiguration {
  const workspace = readWorkspace(tree);
  if (!workspace.projects[projectName]) {
    throw new Error(
      getWorkspacePath(tree)
        ? `Cannot find configuration for '${projectName}' in ${getWorkspacePath(
            tree
          )}.`
        : `Cannot find configuration for '${projectName}'`
    );
  }

  return getProjectConfiguration(projectName, workspace);
}

export function readNxConfig(tree: Tree): NxConfig | null {
  let nxConfig = null;
  for (const extension in fileHandlers) {
    const file = `nx.${extension}`;
    if (tree.exists(file)) {
      nxConfig = fileHandlers[extension].read<NxConfig>(tree, file);
      break;
    }
  }
  if (nxConfig && nxConfig.extends) {
    nxConfig = { ...readNxConfigExtends(tree, nxConfig.extends), ...nxConfig };
  }
  return nxConfig;
}

/**
 * Returns if a project has a standalone configuration.
 *
 * Supported filenames:
 *
 * - project.json
 * - project.yaml
 *
 * @param tree - the file system tree
 * @param project - the project name
 */
export function isStandaloneProject(tree: Tree, project: string): boolean {
  const path = getWorkspacePath(tree);
  const extension = path.split('.').slice(-1)[0] || 'json';
  const rawWorkspace =
    path && tree.exists(path)
      ? fileHandlers[extension].read<RawProjectsConfigurations>(tree, path)
      : null;
  if (rawWorkspace) {
    const projectConfig = rawWorkspace.projects?.[project];
    return typeof projectConfig === 'string';
  }
  return true;
}

function getProjectConfiguration(
  projectName: string,
  workspace: ProjectsConfigurations
): ProjectConfiguration {
  return {
    ...readWorkspaceSection(workspace, projectName),
  };
}

function readWorkspaceSection(
  workspace: ProjectsConfigurations,
  projectName: string
) {
  return workspace.projects[projectName];
}

function setProjectConfiguration(
  tree: Tree,
  projectName: string,
  projectConfiguration: ProjectConfiguration,
  mode: 'create' | 'update' | 'delete',
  standalone: boolean = false
): void {
  if (mode === 'delete') {
    addProjectToWorkspaceConfig(
      tree,
      projectName,
      readProjectConfiguration(tree, projectName),
      mode
    );
    return;
  }

  if (!projectConfiguration) {
    throw new Error(
      `Cannot ${mode} "${projectName}" with value ${projectConfiguration}`
    );
  }

  addProjectToWorkspaceConfig(
    tree,
    projectName,
    projectConfiguration,
    mode,
    standalone
  );
}

export function getRelativeProjectConfigSchemaPath(
  tree: Tree,
  project: ProjectConfiguration
): string {
  return normalizePath(
    relative(
      join(tree.root, project.root),
      join(tree.root, 'node_modules/nx/schemas/project-schema.json')
    )
  );
}

function addProjectToWorkspaceConfig(
  tree: Tree,
  projectName: string,
  project: ProjectConfiguration,
  mode: 'create' | 'update' | 'delete',
  standalone: boolean = false
) {
  const workspaceConfigPath = getWorkspacePath(tree);
  const workspaceConfig = readRawWorkspaceConfig(tree);
  if (workspaceConfigPath) {
    validateProjectConfigurationOperationsGivenWorkspaceJson(
      mode,
      workspaceConfig,
      projectName
    );
  } else {
    validateProjectConfigurationOperationsWithoutWorkspaceJson(
      mode,
      projectName,
      project.root,
      tree
    );
  }

  const projectConfigFile =
    (mode === 'create' && standalone) || !workspaceConfigPath
      // TODO(milahu): project.yaml
      ? joinPathFragments(project.root, 'project.json')
      : getProjectFileLocation(tree, projectName);
  const jsonSchema =
    projectConfigFile && mode === 'create'
      ? { $schema: getRelativeProjectConfigSchemaPath(tree, project) }
      : {};

  if (projectConfigFile) {
    if (mode === 'delete') {
      tree.delete(projectConfigFile);
      delete workspaceConfig.projects[projectName];
    } else {
      // keep real workspace up to date
      if (workspaceConfigPath && mode === 'create') {
        workspaceConfig.projects[projectName] = project.root;
      }

      // update the project.json file
      writeJson(tree, projectConfigFile, {
        name: mode === 'create' ? projectName : project.name ?? projectName,
        ...jsonSchema,
        ...project,
        root: undefined,
      });
    }
  } else if (mode === 'delete') {
    delete workspaceConfig.projects[projectName];
  } else {
    workspaceConfig.projects[projectName] = project;
  }
  if (workspaceConfigPath && tree.exists(workspaceConfigPath)) {
    writeJson(
      tree,
      workspaceConfigPath,
      reformattedWorkspaceJsonOrNull(workspaceConfig) ?? workspaceConfig
    );
  }
}

/**
 * Read the workspace configuration, including projects.
 */
export function readWorkspace(tree: Tree): ProjectsConfigurations {
  const workspaceConfig = inlineProjectConfigurationsWithTree(tree);
  const originalVersion = workspaceConfig.version;
  return {
    ...toNewFormat(workspaceConfig),
    version: originalVersion,
  };
}

/**
 * This has to be separate from the inline functionality inside nx,
 * as the functionality in nx does not use a Tree. Changes made during
 * a generator would not be present during runtime execution.
 * @returns
 */
function inlineProjectConfigurationsWithTree(
  tree: Tree
): ProjectsConfigurations {
  const workspaceConfig = readRawWorkspaceConfig(tree);
  Object.entries(workspaceConfig.projects || {}).forEach(([project, config]) => {
    if (typeof config === 'string') {
      // TODO(milahu): project.yaml
      const configFileLocation = joinPathFragments(config, 'project.json');
      const extension = configFileLocation.split('.').slice(-1)[0] || 'json';
      workspaceConfig.projects[project] = {
        root: config,
        ...fileHandlers[extension].read<ProjectConfiguration>(tree, configFileLocation),
      };
    }
  });
  return workspaceConfig as ProjectsConfigurations;
}

/**
 * Used to ensure that projects created during
 * the same devkit generator run show up when
 * there is no workspace.json file, as `glob`
 * cannot find them.
 *
 * We exclude the root `package.json` from this list unless
 * considered a project during workspace generation
 */
function findCreatedProjects(tree: Tree) {
  const createdProjectFiles = [];

  for (const change of tree.listChanges()) {
    if (change.type === 'CREATE') {
      const fileName = basename(change.path);
      // all created project json files are created projects
      // TODO(milahu): project.yaml
      if (fileName === 'project.json') {
        createdProjectFiles.push(change.path);
      } else if (fileName === 'package.json') {
        // created package.json files are projects by default *unless* they are at the root
        const includedByDefault = change.path === 'package.json' ? false : true;
        // If the file should be included by default
        if (includedByDefault) {
          createdProjectFiles.push(change.path);
        } else {
          const contents: PackageJson = JSON.parse(change.content.toString());
          // if the file should be included by the Nx property
          if (contents.nx) {
            createdProjectFiles.push(change.path);
          }
        }
      }
    }
  }
  return deduplicateProjectFiles(createdProjectFiles);
}

/**
 * Used to ensure that projects created during
 * the same devkit generator run show up when
 * there is no workspace.json file, as `glob`
 * cannot find them.
 */
function findDeletedProjects(tree: Tree) {
  return tree.listChanges().filter((f) => {
    const fileName = basename(f.path);
    return (
      f.type === 'DELETE' &&
      // TODO(milahu): project.yaml
      (fileName === 'project.json' || fileName === 'package.json')
    );
  });
}

let staticFSWorkspace: RawProjectsConfigurations;
let cachedTree: Tree;
function readRawWorkspaceConfig(tree: Tree): RawProjectsConfigurations {
  const path = getWorkspacePath(tree);
  if (path && tree.exists(path)) {
    // `workspace.json` exists, use it.
    const extension = path.split('.').slice(-1)[0] || 'json';
    return fileHandlers[extension].read<RawProjectsConfigurations>(tree, path);
  } else {
    const nxConfig = readNxConfig(tree);
    const createdProjects = buildWorkspaceConfigurationFromGlobs(
      nxConfig,
      findCreatedProjects(tree),
      (file) => {
        const extension = file.split('.').slice(-1)[0] || 'json';
        return fileHandlers[extension].read(tree, file);
      }
    ).projects;
    // We already have built a cache but need to confirm it's the same tree
    if (!staticFSWorkspace || tree !== cachedTree) {
      staticFSWorkspace = buildWorkspaceConfigurationFromGlobs(
        nxConfig,
        [...globForProjectFiles(tree.root, nxConfig)],
        (file) => {
          const extension = file.split('.').slice(-1)[0] || 'json';
          return fileHandlers[extension].read(tree, file);
        }
      );
      cachedTree = tree;
    }
    const projects = { ...staticFSWorkspace.projects, ...createdProjects };
    findDeletedProjects(tree).forEach((file) => {
      const matchingStaticProject = Object.entries(projects).find(
        ([, config]) =>
          typeof config === 'string'
            ? config === dirname(file.path)
            : config.root === dirname(file.path)
      );

      if (matchingStaticProject) {
        delete projects[matchingStaticProject[0]];
      }
    });
    staticFSWorkspace = {
      ...staticFSWorkspace,
      projects,
    };
    return staticFSWorkspace;
  }
}

/**
 * @description Determine where a project's configuration is located.
 * @returns file path if separate from root config, null otherwise.
 */
function getProjectFileLocation(tree: Tree, project: string): string | null {
  const rawWorkspace = readRawWorkspaceConfig(tree);
  const projectConfig = rawWorkspace.projects?.[project];
  return typeof projectConfig === 'string'
    // TODO(milahu): project.yaml
    ? joinPathFragments(projectConfig, 'project.json')
    : null;
}

function validateProjectConfigurationOperationsGivenWorkspaceJson(
  mode: 'create' | 'update' | 'delete',
  workspaceConfig: RawProjectsConfigurations | ProjectsConfigurations | null,
  projectName: string
) {
  if (mode == 'create' && workspaceConfig.projects[projectName]) {
    throw new Error(
      `Cannot create Project '${projectName}'. It already exists.`
    );
  }
  if (mode == 'update' && !workspaceConfig.projects[projectName]) {
    throw new Error(
      `Cannot update Project '${projectName}'. It does not exist.`
    );
  }
  if (mode == 'delete' && !workspaceConfig.projects[projectName]) {
    throw new Error(
      `Cannot delete Project '${projectName}'. It does not exist.`
    );
  }
}

function validateProjectConfigurationOperationsWithoutWorkspaceJson(
  mode: 'create' | 'update' | 'delete',
  projectName: string,
  projectRoot: string,
  tree: Tree
) {
  if (
    mode == 'create' &&
    // TODO(milahu): project.yaml
    tree.exists(joinPathFragments(projectRoot, 'project.json'))
  ) {
    throw new Error(
      `Cannot create a new project at ${projectRoot}. It already exists.`
    );
  }
  if (
    mode == 'update' &&
    // TODO(milahu): project.yaml
    !tree.exists(joinPathFragments(projectRoot, 'project.json'))
  ) {
    throw new Error(
      `Cannot update Project ${projectName} at ${projectRoot}. It doesn't exist or uses package.json configuration.`
    );
  }
  if (mode == 'delete' && !tree.exists(joinPathFragments(projectRoot))) {
    throw new Error(
      `Cannot delete Project ${projectName}. It doesn't exist or uses package.json configuration.`
    );
  }
}

export function shouldDefaultToUsingStandaloneConfigs(tree: Tree): boolean {
  const workspacePath = getWorkspacePath(tree);
  let rawWorkspace: RawProjectsConfigurations | null = null;
  if (!(workspacePath && tree.exists(workspacePath))) {
    return true; // if workspace.json doesn't exist, all projects **must** be standalone
  }
  const extension = workspacePath.split('.').slice(-1)[0] || 'json';
  rawWorkspace = fileHandlers[extension].read<RawProjectsConfigurations>(tree, workspacePath);
  return Object.values(rawWorkspace.projects).reduce(
    // default for second, third... projects should be based on all projects being defined as a path
    // for configuration read from ng schematics, this is determined by configFilePath's presence
    (allStandalone, next) =>
      allStandalone &&
      (typeof next === 'string' || 'configFilePath' in next),
    // default for first project should be true if using Nx Schema
    rawWorkspace.version > 1
  );
}

type WorkspaceConfigFiles = '/angular.json' | '/workspace.json' | '/workspace.yaml';

export function getWorkspacePath(
  tree: Tree
): WorkspaceConfigFiles | null {
  const possibleFiles: (WorkspaceConfigFiles)[] = [
    '/angular.json',
    '/workspace.json',
    '/workspace.yaml',
  ];
  return possibleFiles.find((path) => tree.exists(path));
}
