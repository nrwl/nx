import { minimatch } from 'minimatch';
import { basename, dirname, join, relative } from 'path';

import { getGlobPatternsFromPackageManagerWorkspaces } from '../../plugins/package-json';
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
import { toProjectName } from '../../config/to-project-name';

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
  if (
    tree.exists(joinPathFragments(projectConfiguration.root, 'project.json'))
  ) {
    updateProjectConfigurationInProjectJson(
      tree,
      projectName,
      projectConfiguration
    );
  } else if (
    tree.exists(joinPathFragments(projectConfiguration.root, 'package.json'))
  ) {
    updateProjectConfigurationInPackageJson(
      tree,
      projectName,
      projectConfiguration
    );
  } else {
    throw new Error(
      `Cannot update Project ${projectName} at ${projectConfiguration.root}. It either doesn't exist yet, or may not use project.json for configuration. Use \`addProjectConfiguration()\` instead if you want to create a new project.`
    );
  }
}

function updateProjectConfigurationInPackageJson(
  tree: Tree,
  projectName: string,
  projectConfiguration: ProjectConfiguration
) {
  const packageJsonFile = joinPathFragments(
    projectConfiguration.root,
    'package.json'
  );

  const packageJson = readJson<PackageJson>(tree, packageJsonFile);

  projectConfiguration.name = projectName;
  if (packageJson.name === projectConfiguration.name) {
    delete projectConfiguration.name;
  }

  if (
    projectConfiguration.targets &&
    !Object.keys(projectConfiguration.targets).length
  ) {
    delete projectConfiguration.targets;
  }

  packageJson.nx = {
    ...packageJson.nx,
    ...projectConfiguration,
  };

  // We don't want to ever this since it is inferred
  delete packageJson.nx.root;

  // Only set `nx` property in `package.json` if it is a root project (necessary to mark it as Nx project),
  // or if there are properties to be set. If it is empty, then avoid it so we don't add unnecessary boilerplate.
  if (
    projectConfiguration.root === '.' ||
    Object.keys(packageJson.nx).length > 0
  ) {
    writeJson(tree, packageJsonFile, packageJson);
  }
}

function updateProjectConfigurationInProjectJson(
  tree: Tree,
  projectName: string,
  projectConfiguration: ProjectConfiguration
) {
  const projectConfigFile = joinPathFragments(
    projectConfiguration.root,
    'project.json'
  );

  // If there's no package.json, use the original simple logic
  const packageJsonFile = joinPathFragments(
    projectConfiguration.root,
    'package.json'
  );

  if (!tree.exists(packageJsonFile)) {
    handleEmptyTargets(projectName, projectConfiguration);
    writeJson(tree, projectConfigFile, {
      name: projectConfiguration.name ?? projectName,
      $schema: getRelativeProjectJsonSchemaPath(tree, projectConfiguration),
      ...projectConfiguration,
      root: undefined,
    });
    return;
  }

  // When both files exist, only include properties that shouldn't come from package.json
  const existingProjectJson = tree.exists(projectConfigFile)
    ? readJson(tree, projectConfigFile)
    : {};

  const packageJson = readJson<PackageJson>(tree, packageJsonFile);
  const packageJsonNxConfig = packageJson.nx || {};

  // Start with the structure that should always be in project.json
  const updatedProjectJson: any = {
    name: projectConfiguration.name ?? projectName,
    $schema: getRelativeProjectJsonSchemaPath(tree, projectConfiguration),
  };

  // Copy properties that should be in project.json (not package.json)
  for (const [key, value] of Object.entries(projectConfiguration)) {
    if (key === 'root' || key === 'name') continue;

    // Special handling for targets - check each target individually
    if (key === 'targets' && value && typeof value === 'object') {
      const projectTargets = existingProjectJson.targets || {};
      const packageTargets = packageJsonNxConfig.targets || {};
      const resultTargets = {};

      for (const [targetName, targetConfig] of Object.entries(value)) {
        const wasInProjectJson = projectTargets.hasOwnProperty(targetName);
        const isInPackageJson = packageTargets.hasOwnProperty(targetName);

        if (wasInProjectJson || !isInPackageJson) {
          resultTargets[targetName] = targetConfig;
        }
      }

      if (
        Object.keys(resultTargets).length > 0 ||
        Object.keys(value).length === 0
      ) {
        updatedProjectJson[key] = resultTargets;
      }
    } else {
      // For other properties, include if: originally in project.json OR not in package.json
      const wasInProjectJson = existingProjectJson.hasOwnProperty(key);
      const isInPackageJson = packageJsonNxConfig.hasOwnProperty(key);

      if (wasInProjectJson || !isInPackageJson) {
        updatedProjectJson[key] = value;
      }
    }
  }

  handleEmptyTargets(projectName, updatedProjectJson);
  writeJson(tree, projectConfigFile, updatedProjectJson);
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
    ...getGlobPatternsFromPackageManagerWorkspaces(
      tree.root,
      (p) => readJson(tree, p, { expectComments: true }),
      <T extends Object>(p) => {
        const content = tree.read(p, 'utf-8');
        const { load } = require('@zkochan/js-yaml');
        return load(content, { filename: p }) as T;
      },
      (p) => tree.exists(p)
    ),
  ];
  const globbedFiles = globWithWorkspaceContextSync(tree.root, patterns);
  const createdFiles = findCreatedProjectFiles(tree, patterns);
  const deletedFiles = findDeletedProjectFiles(tree, patterns);
  // Ensure we don't duplicate files that are both globbed and in tree changes
  const allProjectFiles = new Set([...globbedFiles, ...createdFiles]);
  const projectFiles = Array.from(allProjectFiles).filter(
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

      // We don't want to have all of the extra inferred stuff in here, as
      // when generators update the project they shouldn't inline that stuff.
      // so rather than using `buildProjectFromPackageJson` and stripping it out
      // we are going to build the config manually.
      const config = {
        root: dirname(projectFile),
        name: packageJson.name ?? toProjectName(projectFile),
        ...packageJson.nx,
      };
      if (!rootMap[config.root]) {
        mergeProjectConfigurationIntoRootMap(
          rootMap,
          // Inferred targets, tags, etc don't show up when running generators
          // This is to help avoid running into issues when trying to update the workspace
          config,
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
    // Include both CREATE and UPDATE changes to handle project files
    // created during generator callbacks (which are marked as UPDATE
    // since the tree has already been flushed to disk)
    if (change.type === 'CREATE' || change.type === 'UPDATE') {
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
