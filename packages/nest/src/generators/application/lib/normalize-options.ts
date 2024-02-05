import { Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { Linter } from '@nx/eslint';
import type { Schema as NodeApplicationGeneratorOptions } from '@nx/node/src/generators/application/schema';
import type { ApplicationGeneratorOptions, NormalizedOptions } from '../schema';

export async function normalizeOptions(
  tree: Tree,
  options: ApplicationGeneratorOptions
): Promise<NormalizedOptions> {
  const {
    projectName: appProjectName,
    projectRoot: appProjectRoot,
    projectNameAndRootFormat,
  } = await determineProjectNameAndRootOptions(tree, {
    name: options.name,
    projectType: 'application',
    directory: options.directory,
    projectNameAndRootFormat: options.projectNameAndRootFormat,
    rootProject: options.rootProject,
    callingGenerator: '@nx/nest:application',
  });
  options.rootProject = appProjectRoot === '.';
  options.projectNameAndRootFormat = projectNameAndRootFormat;

  return {
    addPlugin: process.env.NX_ADD_PLUGINS !== 'false',
    ...options,
    strict: options.strict ?? false,
    appProjectName,
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
    projectNameAndRootFormat: options.projectNameAndRootFormat,
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
    addPlugin: options.addPlugin,
  };
}
