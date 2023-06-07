import { basename, join, relative } from 'path';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from '../../config/workspace-json-project-json';
import {
  buildProjectsConfigurationsFromProjectPaths,
  deduplicateProjectFiles,
  getGlobPatternsFromPlugins,
  globForProjectFiles,
  renamePropertyWithStableKeys,
} from '../../config/workspaces';
import { joinPathFragments, normalizePath } from '../../utils/path';

import type { Tree } from '../tree';

import { readJson, writeJson } from './json';
import { PackageJson } from '../../utils/package-json';
import { readNxJson } from './nx-json';
import { output } from '../../utils/output';
import { getNxRequirePaths } from '../../utils/installation-directory';

export { readNxJson, updateNxJson } from './nx-json';
export {
  readWorkspaceConfiguration,
  updateWorkspaceConfiguration,
  isStandaloneProject,
  getWorkspacePath,
  WorkspaceConfiguration,
} from './deprecated';

/**
 * Adds project configuration to the Nx workspace.
 *
 * @param tree - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 * @param projectConfiguration - project configuration
 * @param standalone - whether the project is configured in workspace.json or not
 */
export function addProjectConfiguration(
  tree: Tree,
  projectName: string,
  projectConfiguration: ProjectConfiguration,
  standalone = true
): void {
  const projectConfigFile = joinPathFragments(
    projectConfiguration.root,
    'project.json'
  );

  if (!standalone) {
    output.warn({
      title:
        'Nx only supports standalone projects. Setting standalone to false is ignored.',
    });
  }

  if (tree.exists(projectConfigFile)) {
    throw new Error(
      `Cannot create a new project ${projectName} at ${projectConfiguration.root}. It already exists.`
    );
  }

  delete (projectConfiguration as any).$schema;
  writeJson(tree, projectConfigFile, {
    name: projectName,
    $schema: getRelativeProjectJsonSchemaPath(tree, projectConfiguration),
    ...projectConfiguration,
    root: undefined,
  });
}

/**
 * Updates the configuration of an existing project.
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
  const projectConfigFile = joinPathFragments(
    projectConfiguration.root,
    'project.json'
  );

  if (!tree.exists(projectConfigFile)) {
    throw new Error(
      `Cannot update Project ${projectName} at ${projectConfiguration.root}. It doesn't exist or uses package.json configuration.`
    );
  }
  writeJson(tree, projectConfigFile, {
    name: projectConfiguration.name ?? projectName,
    $schema: getRelativeProjectJsonSchemaPath(tree, projectConfiguration),
    ...projectConfiguration,
    root: undefined,
  });
}

/**
 * Removes the configuration of an existing project.
 *
 * @param tree - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 */
export function removeProjectConfiguration(
  tree: Tree,
  projectName: string
): void {
  const projectConfiguration = readProjectConfiguration(tree, projectName);
  if (!projectConfiguration) {
    throw new Error(`Cannot delete Project ${projectName}`);
  }
  const projectConfigFile = joinPathFragments(
    projectConfiguration.root,
    'project.json'
  );
  if (tree.exists(projectConfigFile)) {
    tree.delete(projectConfigFile);
  }
}

/**
 * Reads a project configuration.
 *
 * @param tree - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 * @throws If supplied projectName cannot be found
 */
export function readProjectConfiguration(
  tree: Tree,
  projectName: string
): ProjectConfiguration {
  const allProjects = readAndCombineAllProjectConfigurations(tree);
  if (!allProjects[projectName]) {
    // temporary polyfill to make sure our generators work for existing angularcli workspaces
    if (tree.exists('angular.json')) {
      const angularJson = toNewFormat(readJson(tree, 'angular.json'));
      if (angularJson.projects[projectName])
        return angularJson.projects[projectName];
    }
    throw new Error(`Cannot find configuration for '${projectName}'`);
  }
  return allProjects[projectName];
}

/**
 * Get a map of all projects in a workspace.
 *
 * Use {@link readProjectConfiguration} if only one project is needed.
 */
export function getProjects(tree: Tree): Map<string, ProjectConfiguration> {
  let allProjects = readAndCombineAllProjectConfigurations(tree);
  // temporary polyfill to make sure our generators work for existing angularcli workspaces
  if (tree.exists('angular.json')) {
    const angularJson = toNewFormat(readJson(tree, 'angular.json'));
    allProjects = { ...allProjects, ...angularJson.projects };
  }
  return new Map(
    Object.keys(allProjects || {}).map((projectName) => {
      return [projectName, allProjects[projectName]];
    })
  );
}

export function getRelativeProjectJsonSchemaPath(
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

function readAndCombineAllProjectConfigurations(tree: Tree): {
  [name: string]: ProjectConfiguration;
} {
  const nxJson = readNxJson(tree);

  const globbedFiles = globForProjectFiles(
    tree.root,
    getGlobPatternsFromPlugins(nxJson, getNxRequirePaths(tree.root), tree.root),
    nxJson
  ).map(normalizePath);
  const createdFiles = findCreatedProjectFiles(tree);
  const deletedFiles = findDeletedProjectFiles(tree);
  const projectFiles = [...globbedFiles, ...createdFiles].filter(
    (r) => deletedFiles.indexOf(r) === -1
  );

  return buildProjectsConfigurationsFromProjectPaths(
    nxJson,
    projectFiles,
    (file) => readJson(tree, file)
  ).projects;
}

/**
 * Used to ensure that projects created during
 * the same devkit generator run show up when
 * there is no project.json file, as `glob`
 * cannot find them.
 *
 * We exclude the root `package.json` from this list unless
 * considered a project during workspace generation
 */
function findCreatedProjectFiles(tree: Tree) {
  const createdProjectFiles = [];

  for (const change of tree.listChanges()) {
    if (change.type === 'CREATE') {
      const fileName = basename(change.path);
      // all created project json files are created projects
      if (fileName === 'project.json') {
        createdProjectFiles.push(change.path);
      } else if (fileName === 'package.json') {
        try {
          const contents: PackageJson = JSON.parse(change.content.toString());
          if (contents.nx) {
            createdProjectFiles.push(change.path);
          }
        } catch {}
      }
    }
  }
  return deduplicateProjectFiles(createdProjectFiles).map(normalizePath);
}

/**
 * Used to ensure that projects created during
 * the same devkit generator run show up when
 * there is no project.json file, as `glob`
 * cannot find them.
 */
function findDeletedProjectFiles(tree: Tree) {
  return tree
    .listChanges()
    .filter((f) => {
      const fileName = basename(f.path);
      return (
        f.type === 'DELETE' &&
        (fileName === 'project.json' || fileName === 'package.json')
      );
    })
    .map((r) => r.path);
}

function toNewFormat(w: any): ProjectsConfigurations {
  const projects = {};

  Object.keys(w.projects || {}).forEach((name) => {
    if (typeof w.projects[name] === 'string') return;

    const projectConfig = w.projects[name];
    if (projectConfig.architect) {
      renamePropertyWithStableKeys(projectConfig, 'architect', 'targets');
    }
    if (projectConfig.schematics) {
      renamePropertyWithStableKeys(projectConfig, 'schematics', 'generators');
    }
    Object.values(projectConfig.targets || {}).forEach((target: any) => {
      if (target.builder !== undefined) {
        renamePropertyWithStableKeys(target, 'builder', 'executor');
      }
    });

    projects[name] = projectConfig;
  });

  w.projects = projects;
  if (w.schematics) {
    renamePropertyWithStableKeys(w, 'schematics', 'generators');
  }
  if (w.version !== 2) {
    w.version = 2;
  }
  return w;
}
