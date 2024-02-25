import { Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { getNpmScope } from '@nx/js/src/utils/package-json/get-npm-scope';
import type { LibraryGeneratorSchema as JsLibraryGeneratorSchema } from '@nx/js/src/utils/schema';
import { Linter } from '@nx/eslint';
import type { LibraryGeneratorOptions, NormalizedOptions } from '../schema';

export async function normalizeOptions(
  tree: Tree,
  options: LibraryGeneratorOptions
): Promise<NormalizedOptions> {
  const {
    projectName,
    names: projectNames,
    projectRoot,
    importPath,
  } = await determineProjectNameAndRootOptions(tree, {
    name: options.name,
    projectType: 'library',
    directory: options.directory,
    importPath: options.importPath,
    projectNameAndRootFormat: options.projectNameAndRootFormat,
    callingGenerator: '@nx/nest:library',
  });
  options.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';

  const fileName = options.simpleName
    ? projectNames.projectSimpleName
    : projectNames.projectFileName;
  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const normalized: NormalizedOptions = {
    ...options,
    strict: options.strict ?? true,
    controller: options.controller ?? false,
    fileName,
    global: options.global ?? false,
    linter: options.linter ?? Linter.EsLint,
    parsedTags,
    prefix: getNpmScope(tree), // we could also allow customizing this
    projectName,
    projectRoot,
    importPath,
    service: options.service ?? false,
    target: options.target ?? 'es6',
    testEnvironment: options.testEnvironment ?? 'node',
    unitTestRunner: options.unitTestRunner ?? 'jest',
  };

  return normalized;
}

export function toJsLibraryGeneratorOptions(
  options: LibraryGeneratorOptions
): JsLibraryGeneratorSchema {
  return {
    name: options.name,
    bundler: options?.buildable ? 'tsc' : 'none',
    directory: options.directory,
    importPath: options.importPath,
    linter: options.linter,
    publishable: options.publishable,
    skipFormat: true,
    skipTsConfig: options.skipTsConfig,
    skipPackageJson: options.skipPackageJson,
    strict: options.strict,
    tags: options.tags,
    testEnvironment: options.testEnvironment,
    unitTestRunner: options.unitTestRunner,
    config: options.standaloneConfig ? 'project' : 'workspace',
    setParserOptionsProject: options.setParserOptionsProject,
    projectNameAndRootFormat: options.projectNameAndRootFormat,
    addPlugin: options.addPlugin,
  };
}
