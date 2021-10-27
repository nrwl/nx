import type { Tree } from '@nrwl/devkit';
import { getWorkspaceLayout, joinPathFragments, names } from '@nrwl/devkit';
import { Linter } from '@nrwl/linter';
import type { Schema as NodeApplicationGeneratorOptions } from '@nrwl/node/src/generators/application/schema';
import type { ApplicationGeneratorOptions, NormalizedOptions } from '../schema';

export function normalizeOptions(
  tree: Tree,
  options: ApplicationGeneratorOptions
): NormalizedOptions {
  const appDirectory = options.directory
    ? `${names(options.directory).fileName}/${names(options.name).fileName}`
    : names(options.name).fileName;

  const appProjectRoot = joinPathFragments(
    getWorkspaceLayout(tree).appsDir,
    appDirectory
  );

  return {
    ...options,
    appProjectRoot,
    linter: options.linter ?? Linter.EsLint,
    unitTestRunner: options.unitTestRunner ?? 'jest',
  };
}

export function toNodeApplicationGeneratorOptions(
  options: NormalizedOptions
): NodeApplicationGeneratorOptions {
  return {
    name: options.name,
    directory: options.directory,
    frontendProject: options.frontendProject,
    linter: options.linter,
    skipFormat: true,
    skipPackageJson: options.skipPackageJson,
    standaloneConfig: options.standaloneConfig,
    tags: options.tags,
    unitTestRunner: options.unitTestRunner,
    setParserOptionsProject: options.setParserOptionsProject,
    experimentalSwc: options.experimentalSwc,
  };
}
