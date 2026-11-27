import type {
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nx/devkit';
import {
  getProjects,
  globAsync,
  joinPathFragments,
  readJson,
  readNxJson,
  readProjectConfiguration,
} from '@nx/devkit';
import {
  buildPackageJsonPatterns,
  buildPackageJsonWorkspacesMatcher,
  findMatchingConfigFiles,
  readApplicableTargetDefaults,
  toNewFormat,
} from '@nx/devkit/internal';
import { statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as posix from 'node:path/posix';
import type { AngularProjectConfiguration } from '../../utils/types';
import { readNgPackagrConfigFiles } from './ng-packagr-config';

// The library builder executor that replaces each ng-packagr executor.
export const libraryBuilderReplacements = new Map([
  ['@angular-devkit/build-angular:ng-packagr', '@angular/build:library'],
  ['@angular/build:ng-packagr', '@angular/build:library'],
  ['@nx/angular:ng-packagr-lite', '@nx/angular:library'],
  ['@nx/angular:package', '@nx/angular:library'],
]);
export const ngPackagrExecutors = new Set(libraryBuilderReplacements.keys());
export const libraryBuilderExecutors = new Set(
  libraryBuilderReplacements.values()
);

export function getProjectPrefix(
  tree: Tree,
  project: string
): string | undefined {
  return (
    readProjectConfiguration(tree, project) as AngularProjectConfiguration
  ).prefix;
}

export function usesLibraryBuilder(tree: Tree, projectName: string): boolean {
  const project = readProjectConfiguration(tree, projectName);
  const executors = resolveExecutors(tree, project, project.targets);
  // An ng-packagr build target wins over library builder targets.
  if (ngPackagrExecutors.has(executors.build)) {
    return false;
  }

  return Object.values(executors).some((executor) =>
    libraryBuilderExecutors.has(executor)
  );
}

// The devkit view leaves out package.json nx targets next to a project.json and
// angular.json projects, which also build the library's directory. Every
// declaration counts, even one that another file overrides.
export async function findNgPackagrTarget(
  tree: Tree,
  projectName: string
): Promise<{ target: string; file: string } | undefined> {
  const project = readProjectConfiguration(tree, projectName);
  for (const { file, targets } of await readTargetDeclarations(
    tree,
    project.root
  )) {
    const executors = resolveExecutors(tree, project, targets);
    const target = Object.keys(executors).find((name) =>
      ngPackagrExecutors.has(executors[name])
    );
    if (target) {
      return { target, file };
    }
  }

  // ng-packagr writes the exports of the package.json next to the primary
  // configuration, so any target that reads a configuration in the library
  // root ships the library's exports.
  const libraryRoot = resolve(tree.root, project.root);
  for (const declaration of await findWorkspaceNgPackagrTargets(tree)) {
    const configFiles = readNgPackagrConfigFiles(tree, declaration);
    if (
      configFiles.some((configFile) =>
        isSameDirectory(dirname(configFile), libraryRoot)
      )
    ) {
      return { target: declaration.target, file: declaration.file };
    }
  }

  return undefined;
}

// A symlink or a different letter case on a case-insensitive file system names
// the same directory. A directory that isn't on disk yet is compared by path.
function isSameDirectory(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }
  const id = readDirectoryId(a);
  return id !== undefined && id === readDirectoryId(b);
}

function readDirectoryId(path: string): string | undefined {
  try {
    const { dev, ino } = statSync(path, { bigint: true });
    return `${dev}:${ino}`;
  } catch {
    return undefined;
  }
}

export interface NgPackagrTargetDeclaration {
  target: string;
  executor: string;
  file: string;
  root: string;
  project: ProjectConfiguration;
  configuration: TargetConfiguration;
}

// Covers every project.json, package.json and angular.json in the workspace,
// including projects that the devkit view leaves out.
export async function findWorkspaceNgPackagrTargets(
  tree: Tree
): Promise<NgPackagrTargetDeclaration[]> {
  const projectsByRoot = new Map(
    [...getProjects(tree).values()].map((project) => [
      posix.join(project.root, '.'),
      project,
    ])
  );
  const ngPackagrTargets: NgPackagrTargetDeclaration[] = [];
  for (const { file, root, name, targets } of await readTargetDeclarations(
    tree
  )) {
    const project = projectsByRoot.get(posix.join(root, '.')) ?? { name, root };
    const executors = resolveExecutors(tree, project, targets);
    for (const [target, executor] of Object.entries(executors)) {
      if (ngPackagrExecutors.has(executor)) {
        ngPackagrTargets.push({
          target,
          executor,
          file,
          root,
          project,
          configuration: targets[target],
        });
      }
    }
  }

  return ngPackagrTargets;
}

export function usesNgPackagr(project: ProjectConfiguration): boolean {
  return Object.values(project.targets ?? {}).some((target) =>
    ngPackagrExecutors.has(target.executor)
  );
}

interface TargetDeclarations {
  file: string;
  root: string;
  name: string | undefined;
  targets: Record<string, TargetConfiguration> | undefined;
}

// Reads the declarations of the project at `root`, or of every project when
// `root` is undefined.
async function readTargetDeclarations(
  tree: Tree,
  root?: string
): Promise<TargetDeclarations[]> {
  const declarations: TargetDeclarations[] = [];

  // A project.json configures the project at its `root` field (default: its
  // directory), so the library's project.json can be in any directory.
  const projectJsonPaths = await globAsync(tree, [
    'project.json',
    '**/project.json',
  ]);
  for (const file of projectJsonPaths) {
    const projectJson = readJson<ProjectConfiguration>(tree, file);
    declarations.push({
      file,
      root: projectJson.root ?? posix.dirname(file),
      name: projectJson.name,
      targets: projectJson.targets,
    });
  }

  // Nx reads a package.json as a project when the package manager workspaces
  // include it or a project.json is next to it.
  const projectJsonDirs = new Set(projectJsonPaths.map(posix.dirname));
  const isWorkspacePackageJson = buildPackageJsonWorkspacesMatcher(
    buildPackageJsonPatterns(tree.root, (path) => readJson(tree, path))
  );
  const packageJsonPaths = (
    root === undefined
      ? await globAsync(tree, ['package.json', '**/package.json'])
      : [joinPathFragments(root, 'package.json')].filter((path) =>
          tree.exists(path)
        )
  ).filter(
    (path) =>
      isWorkspacePackageJson(path) || projectJsonDirs.has(posix.dirname(path))
  );
  for (const file of packageJsonPaths) {
    const packageJson = readJson(tree, file);
    declarations.push({
      file,
      root: posix.dirname(file),
      name: packageJson.nx?.name ?? packageJson.name,
      targets: packageJson.nx?.targets,
    });
  }

  // Nx reads the root angular.json. @nx/angular/plugin reads the other
  // angular.json files it matches that have a package.json next to them, and
  // resolves their project roots against that directory.
  const isReadByAngularPlugin = createAngularPluginMatcher(tree);
  const angularJsonPaths = (
    root === undefined
      ? await globAsync(tree, ['angular.json', '**/angular.json'])
      : ancestorPaths(root, 'angular.json').filter((path) => tree.exists(path))
  ).filter(
    (path) =>
      path === 'angular.json' ||
      (isReadByAngularPlugin(path) &&
        tree.exists(posix.join(posix.dirname(path), 'package.json')))
  );
  for (const file of angularJsonPaths) {
    const { projects } = toNewFormat(readJson(tree, file));
    for (const [name, angularProject] of Object.entries(projects ?? {})) {
      declarations.push({
        file,
        root: posix.join(posix.dirname(file), angularProject.root ?? ''),
        name,
        targets: angularProject.targets,
      });
    }
  }

  return root === undefined
    ? declarations
    : declarations.filter((declaration) => isSameRoot(declaration.root, root));
}

function createAngularPluginMatcher(tree: Tree): (file: string) => boolean {
  const registrations = (readNxJson(tree)?.plugins ?? [])
    .map((plugin) => (typeof plugin === 'string' ? { plugin } : plugin))
    .filter(({ plugin }) => plugin === '@nx/angular/plugin');
  return (file) =>
    registrations.some(
      ({ include, exclude }) =>
        findMatchingConfigFiles([file], include ?? [], exclude ?? []).length > 0
    );
}

function ancestorPaths(root: string, fileName: string): string[] {
  const segments = root.split('/');
  const paths = new Set<string>();
  for (let depth = segments.length; depth >= 0; depth--) {
    paths.add(joinPathFragments(...segments.slice(0, depth), fileName));
  }
  return [...paths];
}

// Roots are compared as directories: "./libs/lib1" is "libs/lib1".
export function isSameRoot(a: string, b: string): boolean {
  return posix.relative(a, b) === '';
}

// Nx runs a `command` target with nx:run-commands and fills a missing
// executor from targetDefaults.
function resolveExecutors(
  tree: Tree,
  project: ProjectConfiguration,
  targets: Record<string, TargetConfiguration> | undefined
): Record<string, string | undefined> {
  const targetDefaults = readNxJson(tree)?.targetDefaults;
  return Object.fromEntries(
    Object.entries(targets ?? {}).map(([name, target]) => [
      name,
      target.executor ??
        (target.command
          ? 'nx:run-commands'
          : readApplicableTargetDefaults(
              name,
              undefined,
              targetDefaults,
              project.name,
              { name: project.name, type: 'lib', data: project }
            )?.executor),
    ])
  );
}
