import {
  normalizePath,
  readNxJson,
  type ProjectConfiguration,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import {
  mergeTargetConfigurations,
  readApplicableTargetDefaults,
  resolveNxTokensInOptions,
} from '@nx/devkit/internal';
import { join, relative, resolve } from 'node:path';
import * as posix from 'node:path/posix';
import type { NgPackagrTargetDeclaration } from './project';

export function readTargetDefaults(
  tree: Tree,
  project: ProjectConfiguration,
  targetName: string,
  executor: string,
  targetDefaults = readNxJson(tree)?.targetDefaults
): Partial<TargetConfiguration> | null {
  return readApplicableTargetDefaults(
    targetName,
    executor,
    targetDefaults,
    project.name,
    { name: project.name, type: 'lib', data: project }
  );
}

// The options of a run of a target. Target defaults apply to it, and a default
// configuration overrides the target options.
export function readRunOptions(
  target: TargetConfiguration,
  inheritedDefaults: Partial<TargetConfiguration> | null,
  configurationName: string | undefined
): Record<string, any> {
  const { options, configurations } = inheritedDefaults
    ? mergeTargetConfigurations(target, {
        options: inheritedDefaults.options,
        configurations: inheritedDefaults.configurations,
      })
    : target;
  return {
    ...options,
    ...(configurationName === undefined
      ? {}
      : configurations?.[configurationName]),
  };
}

export function resolveTokens(
  path: string,
  project: ProjectConfiguration
): string {
  return resolveNxTokensInOptions({ path }, project, project.name).path;
}

// The absolute path an ng-packagr executor reads for its `project` option.
// `runDir` is the directory the run resolves paths against.
export function resolveNgPackagrProjectPath(
  tree: Tree,
  executor: string,
  projectOption: unknown,
  projectRoot: string,
  runDir = ''
): string {
  const defaultPath = resolve(tree.root, projectRoot, 'ng-package.json');
  if (typeof projectOption !== 'string') {
    return defaultPath;
  }
  // @angular/build:ng-packagr joins `project` to the workspace root, and an
  // empty one reads the default. The other executors resolve it.
  if (executor === '@angular/build:ng-packagr') {
    return projectOption ? join(tree.root, runDir, projectOption) : defaultPath;
  }
  return resolve(tree.root, runDir, projectOption);
}

// The path relative to the workspace root, which starts with "../" for a path
// outside the workspace.
export function toWorkspacePath(tree: Tree, absolutePath: string): string {
  return normalizePath(relative(tree.root, absolutePath));
}

// ng-packagr reads a file, or a directory's ng-package.json, then its
// ng-package.js.
export function findConfigFile(
  tree: Tree,
  configPath: string
): string | undefined {
  if (tree.isFile(configPath)) {
    return configPath;
  }
  return ['ng-package.json', 'ng-package.js']
    .map((file) => posix.join(configPath, file))
    .find((file) => tree.isFile(file));
}

// The absolute paths of the configuration files the runs of an ng-packagr
// target read.
export function readNgPackagrConfigFiles(
  tree: Tree,
  {
    target,
    executor,
    file,
    root,
    project,
    configuration,
  }: NgPackagrTargetDeclaration
): string[] {
  const isAngularJson = posix.basename(file) === 'angular.json';
  const runs: {
    defaults: Partial<TargetConfiguration> | null;
    runDir: string;
  }[] = [];
  // @nx/angular/plugin runs angular.json targets with `ng` from the directory
  // of the angular.json, with the target's own options.
  if (isAngularJson) {
    runs.push({ defaults: null, runDir: posix.dirname(file) });
  }
  // Nx applies target defaults to the targets it runs, the root angular.json
  // ones included.
  if (!isAngularJson || file === 'angular.json') {
    runs.push({
      defaults: readTargetDefaults(tree, project, target, executor),
      runDir: '',
    });
  }

  const configFiles = new Set<string>();
  for (const { defaults, runDir } of runs) {
    const configurationNames = new Set([
      undefined,
      ...Object.keys(configuration.configurations ?? {}),
      ...Object.keys(defaults?.configurations ?? {}),
    ]);
    for (const configurationName of configurationNames) {
      const value = readRunOptions(configuration, defaults, configurationName)[
        'project'
      ];
      const projectPath = resolveNgPackagrProjectPath(
        tree,
        executor,
        typeof value === 'string' && !isAngularJson
          ? resolveTokens(value, project)
          : value,
        root,
        runDir
      );
      const configFile = findConfigFile(
        tree,
        toWorkspacePath(tree, projectPath)
      );
      if (configFile) {
        configFiles.add(resolve(tree.root, configFile));
      }
    }
  }
  return [...configFiles];
}
