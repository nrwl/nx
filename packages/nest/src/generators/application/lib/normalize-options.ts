import { extractLayoutDirectory, Tree } from '@nx/devkit';
import { getWorkspaceLayout, joinPathFragments, names } from '@nx/devkit';
import { Linter } from '@nx/linter';
import type { Schema as NodeApplicationGeneratorOptions } from '@nx/node/src/generators/application/schema';
import type { ApplicationGeneratorOptions, NormalizedOptions } from '../schema';

export function normalizeOptions(
  tree: Tree,
  options: ApplicationGeneratorOptions
): NormalizedOptions {
  const { layoutDirectory, projectDirectory } = extractLayoutDirectory(
    options.directory
  );

  const appDirectory = projectDirectory
    ? `${names(projectDirectory).fileName}/${names(options.name).fileName}`
    : names(options.name).fileName;

  const appProjectRoot = options.rootProject
    ? '.'
    : joinPathFragments(
        layoutDirectory ?? getWorkspaceLayout(tree).appsDir,
        appDirectory
      );

  return {
    ...options,
    strict: options.strict ?? false,
    appProjectRoot,
    linter: options.linter ?? Linter.EsLint,
    unitTestRunner: options.unitTestRunner ?? 'jest',
    e2eTestRunner: options.e2eTestRunner ?? 'jest',
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
    e2eTestRunner: options.e2eTestRunner,
    setParserOptionsProject: options.setParserOptionsProject,
    rootProject: options.rootProject,
    bundler: 'webpack', // Some features require webpack plugins such as TS transformers
    isNest: true,
  };
}
