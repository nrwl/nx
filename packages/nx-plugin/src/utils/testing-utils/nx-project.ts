import { ensureDirSync } from 'fs-extra';
import {
  createProjectGraphAsync,
  getDependentPackagesForProject,
  getLibraryImportPath,
  getOutputPath,
  ProjectGraph,
  WorkspaceLibrary,
  workspaceRoot,
} from '@nrwl/devkit';
import { readJsonFile, writeJsonFile } from '@nrwl/devkit';

import { runNxNewCommand } from './async-commands';
import { tmpProjPath } from './paths';
import { cleanup } from './utils';
import { runPackageManagerInstall } from './run-package-manager-install';

interface Plugin {
  npmPackageName: string;
  pluginDistPath: string;
  workspaceLibraries: WorkspaceLibrary[];
}

export function patchPackageJsonForPlugin(
  npmPackageName: string,
  distPath: string
) {
  const path = tmpProjPath('package.json');
  const json = readJsonFile(path);
  json.devDependencies[npmPackageName] = `file:${workspaceRoot}/${distPath}`;
  writeJsonFile(path, json);
}

/**
 * Generate a unique name for running CLI commands
 * @param prefix
 *
 * @returns `'<prefix><random number>'`
 */
export function uniq(prefix: string) {
  return `${prefix}${Math.floor(Math.random() * 10000000)}`;
}

/**
 * Creates a new nx project in the e2e directory
 *
 * @param npmPackageName package name to test
 * @param pluginDistPath dist path where the plugin was outputted to
 */
export async function newNxProject(...projectNames: string[]): Promise<void> {
  cleanup();
  runNxNewCommand('', true);

  const projectGraph = await createProjectGraphAsync();
  const projectDependencyMap = new Map<string, Plugin>();
  projectNames.forEach((name) =>
    patchProjectDistFolder(projectGraph, projectDependencyMap, name)
  );
  projectNames.forEach((name) =>
    updatePackageInRoot(projectDependencyMap, name)
  );

  runPackageManagerInstall();
}

/**
 * Ensures that a project has been setup in the e2e directory
 * It will also copy `@nrwl` packages to the e2e directory
 * @param projectNames list of project names that need to be configured before a given e2e test can be run
 */
export async function ensureNxProject(
  ...projectNames: string[]
): Promise<void> {
  ensureDirSync(tmpProjPath());
  await newNxProject(...projectNames);
}

function patchProjectDistFolder(
  projectGraph: ProjectGraph,
  projectDependencyMap: Map<string, Plugin>,
  name: string
) {
  if (projectDependencyMap.has(name)) {
    return;
  }

  const plugin = getPlugin(projectGraph, name);
  projectDependencyMap.set(name, plugin);

  plugin.workspaceLibraries.forEach((library) =>
    patchProjectDistFolder(projectGraph, projectDependencyMap, library.name)
  );

  if (plugin.workspaceLibraries.length > 0) {
    updatePackageInDist(projectDependencyMap, plugin);
    runPackageManagerInstall(true, `${workspaceRoot}/${plugin.pluginDistPath}`);
  }
}

function getPlugin(projectGraph: ProjectGraph, name: string): Plugin {
  const npmPackageName = getLibraryImportPath(name, projectGraph);

  if (npmPackageName == null) {
    throw new Error(
      `Project "${name}" does not have an import path in tsconfig`
    );
  }

  return {
    npmPackageName,
    pluginDistPath: getOutputPath(projectGraph, name),
    workspaceLibraries: getDependentPackagesForProject(projectGraph, name)
      .workspaceLibraries,
  };
}

function updatePackageInRoot(
  projectDependencyMap: Map<string, Plugin>,
  name: string
) {
  const plugin = projectDependencyMap.get(name);
  if (plugin == null || plugin.workspaceLibraries.length === 0) {
    return;
  }

  const packageJsonPath = tmpProjPath('package.json');
  const packageJson = readJsonFile(packageJsonPath);

  packageJson.devDependencies[
    plugin.npmPackageName
  ] = `file:${workspaceRoot}/${plugin.pluginDistPath}`;

  writeJsonFile(packageJsonPath, packageJson);
}

function updatePackageInDist(
  projectDependencyMap: Map<string, Plugin>,
  plugin: Plugin
) {
  const packageJsonPath = `${workspaceRoot}/${plugin.pluginDistPath}/package.json`;
  const packageJson = readJsonFile(packageJsonPath);

  for (const {
    npmPackageName,
    pluginDistPath,
  } of projectDependencyMap.values()) {
    if (
      packageJson.dependencies != null &&
      npmPackageName in packageJson.dependencies
    ) {
      packageJson.dependencies[
        npmPackageName
      ] = `file:${workspaceRoot}/${pluginDistPath}`;
    }
    if (
      packageJson.peerDependencies != null &&
      npmPackageName in packageJson.peerDependencies
    ) {
      packageJson.peerDependencies[
        npmPackageName
      ] = `file:${workspaceRoot}/${pluginDistPath}`;
    }
  }

  writeJsonFile(packageJsonPath, packageJson);
}
