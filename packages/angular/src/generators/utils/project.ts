import type {
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nx/devkit';
import {
  globAsync,
  joinPathFragments,
  readJson,
  readNxJson,
  readProjectConfiguration,
} from '@nx/devkit';
import { readApplicableTargetDefaults, toNewFormat } from '@nx/devkit/internal';
import * as posix from 'node:path/posix';
import type { AngularProjectConfiguration } from '../../utils/types';

const libraryBuilderExecutors = new Set([
  '@nx/angular:library',
  '@angular/build:library',
]);
const ngPackagrExecutors = new Set([
  '@angular-devkit/build-angular:ng-packagr',
  '@angular/build:ng-packagr',
  '@nx/angular:ng-packagr-lite',
  '@nx/angular:package',
]);

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

  return undefined;
}

export function usesNgPackagr(project: ProjectConfiguration): boolean {
  return Object.values(project.targets ?? {}).some((target) =>
    ngPackagrExecutors.has(target.executor)
  );
}

interface TargetDeclarations {
  file: string;
  targets: Record<string, TargetConfiguration> | undefined;
}

async function readTargetDeclarations(
  tree: Tree,
  root: string
): Promise<TargetDeclarations[]> {
  const declarations: TargetDeclarations[] = [];

  // A project.json configures the project at its `root` field (default: its
  // directory), so the library's project.json can be in any directory.
  for (const file of await globAsync(tree, [
    'project.json',
    '**/project.json',
  ])) {
    const projectJson = readJson<ProjectConfiguration>(tree, file);
    if (isSameRoot(projectJson.root ?? posix.dirname(file), root)) {
      declarations.push({ file, targets: projectJson.targets });
    }
  }
  const packageJsonPath = joinPathFragments(root, 'package.json');
  if (tree.exists(packageJsonPath)) {
    declarations.push({
      file: packageJsonPath,
      targets: readJson(tree, packageJsonPath).nx?.targets,
    });
  }

  // @nx/angular/plugin reads angular.json files in any directory and resolves
  // their project roots against that directory.
  const segments = root.split('/');
  for (let depth = segments.length; depth >= 0; depth--) {
    const angularJsonPath = joinPathFragments(
      ...segments.slice(0, depth),
      'angular.json'
    );
    if (!tree.exists(angularJsonPath)) {
      continue;
    }
    const { projects } = toNewFormat(readJson(tree, angularJsonPath));
    for (const angularProject of Object.values(projects ?? {})) {
      const angularRoot = posix.join(
        posix.dirname(angularJsonPath),
        angularProject.root ?? ''
      );
      if (isSameRoot(angularRoot, root)) {
        declarations.push({
          file: angularJsonPath,
          targets: angularProject.targets,
        });
      }
    }
  }

  return declarations;
}

// Roots are compared as directories: "./libs/lib1" is "libs/lib1".
function isSameRoot(a: string, b: string): boolean {
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
