import { basename, dirname, join, relative } from 'path';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from '../../config/workspace-json-project-json';
import {
  buildProjectsConfigurationsFromGlobs,
  deduplicateProjectFiles,
  globForProjectFiles,
  renamePropertyWithStableKeys,
} from '../../config/workspaces';
import { joinPathFragments, normalizePath } from '../../utils/path';

import type { Tree } from '../tree';

import { readJson, writeJson } from './json';
import { PackageJson } from '../../utils/package-json';
import { readNxJson } from './nx-json';
import { output } from '../../utils/output';

export { readNxJson, updateNxJson } from './nx-json';

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

  writeJson(tree, projectConfigFile, {
    name: projectName,
    $schema: getRelativeProjectJsonSchemaPath(tree, projectConfiguration),
    ...projectConfiguration,
    root: undefined, // TODO vsvakin do we need this?
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

  const globbedProjects = buildProjectsConfigurationsFromGlobs(
    nxJson,
    [...globForProjectFiles(tree.root, nxJson)],
    (file) => readJson(tree, file)
  ).projects;

  const createdProjects = buildProjectsConfigurationsFromGlobs(
    nxJson,
    findCreatedProjects(tree),
    (file) => readJson(tree, file)
  ).projects;

  const projects = {
    ...globbedProjects,
    ...createdProjects,
  };

  findDeletedProjects(tree).forEach((file) => {
    const matchingStaticProject = Object.entries(projects).find(
      ([, config]) => (config as any).root === dirname(file.path)
    );
    if (matchingStaticProject) {
      delete projects[matchingStaticProject[0]];
    }
  });
  return projects;
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
function findCreatedProjects(tree: Tree) {
  const createdProjectFiles = [];

  for (const change of tree.listChanges()) {
    if (change.type === 'CREATE') {
      const fileName = basename(change.path);
      // all created project json files are created projects
      if (fileName === 'project.json') {
        createdProjectFiles.push(change.path);
      } else if (fileName === 'package.json') {
        const contents: PackageJson = JSON.parse(change.content.toString());
        if (contents.nx) {
          createdProjectFiles.push(change.path);
        }
      }
    }
  }
  return deduplicateProjectFiles(createdProjectFiles);
}

/**
 * Used to ensure that projects created during
 * the same devkit generator run show up when
 * there is no project.json file, as `glob`
 * cannot find them.
 */
function findDeletedProjects(tree: Tree) {
  return tree.listChanges().filter((f) => {
    const fileName = basename(f.path);
    return (
      f.type === 'DELETE' &&
      (fileName === 'project.json' || fileName === 'package.json')
    );
  });
}

function toNewFormat(w: any): ProjectsConfigurations {
  Object.values(w.projects || {}).forEach((projectConfig: any) => {
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
  });
  if (w.schematics) {
    renamePropertyWithStableKeys(w, 'schematics', 'generators');
  }
  if (w.version !== 2) {
    w.version = 2;
  }
  return w;
}
