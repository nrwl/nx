import { minimatch } from 'minimatch';
import { basename, join, relative } from 'path';

import {
  buildProjectConfigurationFromPackageJson,
  getGlobPatternsFromPackageManagerWorkspaces,
} from '../../plugins/package-json-workspaces';
import { buildProjectFromProjectJson } from '../../plugins/project-json/build-nodes/project-json';
import { renamePropertyWithStableKeys } from '../../adapter/angular-json';
import {
  ProjectConfiguration,
  ProjectsConfigurations,
} from '../../config/workspace-json-project-json';
import {
  mergeProjectConfigurationIntoRootMap,
  readProjectConfigurationsFromRootMap,
} from '../../project-graph/utils/project-configuration-utils';
import { globWithWorkspaceContextSync } from '../../utils/workspace-context';
import { output } from '../../utils/output';
import { PackageJson } from '../../utils/package-json';
import { joinPathFragments, normalizePath } from '../../utils/path';
import { readJson, writeJson } from './json';
import { readNxJson } from './nx-json';

import type { Tree } from '../tree';

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
      `Cannot create a new project ${projectName} at ${projectConfiguration.root}. A project already exists in this directory.`
    );
  }

  delete (projectConfiguration as any).$schema;

  handleEmptyTargets(projectName, projectConfiguration);

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
      `Cannot update Project ${projectName} at ${projectConfiguration.root}. It either doesn't exist yet, or may not use project.json for configuration. Use \`addProjectConfiguration()\` instead if you want to create a new project.`
    );
  }
  handleEmptyTargets(projectName, projectConfiguration);
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
  /**
   * We can't update projects that come from plugins anyways, so we are going
   * to ignore them for now. Plugins should add their own add/create/update methods
   * if they would like to use devkit to update inferred projects.
   */
  const patterns = [
    '**/project.json',
    'project.json',
    ...getGlobPatternsFromPackageManagerWorkspaces(tree.root, (p) =>
      readJson(tree, p, { expectComments: true })
    ),
  ];
  const globbedFiles = globWithWorkspaceContextSync(tree.root, patterns);
  const createdFiles = findCreatedProjectFiles(tree, patterns);
  const deletedFiles = findDeletedProjectFiles(tree, patterns);
  const projectFiles = [...globbedFiles, ...createdFiles].filter(
    (r) => deletedFiles.indexOf(r) === -1
  );

  const rootMap: Record<string, ProjectConfiguration> = {};
  for (const projectFile of projectFiles) {
    if (basename(projectFile) === 'project.json') {
      const json = readJson(tree, projectFile);
      const config = buildProjectFromProjectJson(json, projectFile);
      mergeProjectConfigurationIntoRootMap(
        rootMap,
        config,
        undefined,
        undefined,
        true
      );
    } else if (basename(projectFile) === 'package.json') {
      const packageJson = readJson<PackageJson>(tree, projectFile);
      const config = buildProjectConfigurationFromPackageJson(
        packageJson,
        tree.root,
        projectFile,
        readNxJson(tree)
      );
      if (!rootMap[config.root]) {
        mergeProjectConfigurationIntoRootMap(
          rootMap,
          // Inferred targets, tags, etc don't show up when running generators
          // This is to help avoid running into issues when trying to update the workspace
          {
            name: config.name,
            root: config.root,
          },
          undefined,
          undefined,
          true
        );
      }
    }
  }

  return readProjectConfigurationsFromRootMap(rootMap);
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
function findCreatedProjectFiles(tree: Tree, globPatterns: string[]) {
  const createdProjectFiles = [];

  for (const change of tree.listChanges()) {
    if (change.type === 'CREATE') {
      const fileName = basename(change.path);
      if (
        globPatterns.some((pattern) =>
          minimatch(change.path, pattern, { dot: true })
        )
      ) {
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
  return createdProjectFiles.map(normalizePath);
}

/**
 * Used to ensure that projects created during
 * the same devkit generator run show up when
 * there is no project.json file, as `glob`
 * cannot find them.
 */
function findDeletedProjectFiles(tree: Tree, globPatterns: string[]) {
  return tree
    .listChanges()
    .filter((f) => {
      return (
        f.type === 'DELETE' &&
        globPatterns.some((pattern) => minimatch(f.path, pattern))
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

function handleEmptyTargets(
  projectName: string,
  projectConfiguration: ProjectConfiguration
): void {
  if (
    projectConfiguration.targets &&
    !Object.keys(projectConfiguration.targets).length
  ) {
    // Re-order `targets` to appear after the `// target` comment.
    delete projectConfiguration.targets;
    projectConfiguration[
      '// targets'
    ] = `to see all targets run: nx show project ${projectName} --web`;
    projectConfiguration.targets = {};
  } else {
    delete projectConfiguration['// targets'];
  }
}
