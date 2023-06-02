import type { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectsConfigurations } from '../../config/workspace-json-project-json';

import type { Tree } from '../tree';
import { readNxJson, updateNxJson } from './nx-json';

// TODO(v16): Remove this
/**
 * @deprecated using NxJsonConfiguration
 */
export type WorkspaceConfiguration = Omit<ProjectsConfigurations, 'projects'> &
  Partial<NxJsonConfiguration>;

// TODO(v16): Remove this
/**
 * Update general workspace configuration such as the default project or cli settings.
 *
 * This does _not_ update projects configuration, use {@link updateProjectConfiguration} or {@link addProjectConfiguration} instead.
 *
 * @deprecated use updateNxJson
 */
export function updateWorkspaceConfiguration(
  tree: Tree,
  workspaceConfig: WorkspaceConfiguration
): void {
  const {
    // Nx Json Properties
    cli,
    defaultProject,
    generators,
    implicitDependencies,
    plugins,
    pluginsConfig,
    npmScope,
    namedInputs,
    targetDefaults,
    workspaceLayout,
    tasksRunnerOptions,
    affected,
    extends: ext,
    installation,
  } = workspaceConfig;

  const nxJson: Required<NxJsonConfiguration> = {
    implicitDependencies,
    plugins,
    pluginsConfig,
    npmScope,
    namedInputs,
    targetDefaults,
    workspaceLayout,
    tasksRunnerOptions,
    affected,
    cli,
    generators,
    defaultProject,
    extends: ext,
    installation,
  };

  updateNxJson(tree, nxJson);
}

// TODO(v16): Remove this
/**
 * Returns if a project has a standalone configuration (project.json).
 *
 * @param tree - the file system tree
 * @param project - the project name
 *
 * @deprecated non-standalone projects were deprecated
 */
export function isStandaloneProject(tree: Tree, project: string): boolean {
  return true;
}

// TODO(v16): Remove this
/**
 * Read general workspace configuration such as the default project or cli settings
 *
 * This does _not_ provide projects configuration, use {@link readProjectConfiguration} instead.
 * @deprecated use readNxJson
 */
export function readWorkspaceConfiguration(tree: Tree): WorkspaceConfiguration {
  return readNxJson(tree) as any;
}

// TODO(v16): Remove this
/**
 * @deprecated all projects are configured using project.json
 */
export function getWorkspacePath(tree: Tree) {
  if (tree.exists('workspace.json')) return 'workspace.json';
  if (tree.exists('angular.json')) return 'angular.json';
  return null;
}
