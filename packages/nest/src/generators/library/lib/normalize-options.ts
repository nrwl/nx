import { Tree, readNxJson } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { getNpmScope } from '@nx/js/src/utils/package-json/get-npm-scope';
import type { LibraryGeneratorSchema as JsLibraryGeneratorSchema } from '@nx/js/src/generators/library/schema';
import { Linter } from '@nx/eslint';
import type { LibraryGeneratorOptions, NormalizedOptions } from '../schema';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

export async function normalizeOptions(
  tree: Tree,
  options: LibraryGeneratorOptions
): Promise<NormalizedOptions> {
  await ensureRootProjectName(options, 'library');
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
  });
  const nxJson = readNxJson(tree);
  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  options.addPlugin ??= addPlugin;

  const fileName = options.simpleName
    ? projectNames.projectSimpleName
    : projectNames.projectFileName;
  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const isUsingTsSolutionsConfig = isUsingTsSolutionSetup(tree);
  const normalized: NormalizedOptions = {
    ...options,
    strict: options.strict ?? true,
    controller: options.controller ?? false,
    fileName,
    global: options.global ?? false,
    linter: options.linter ?? Linter.EsLint,
    parsedTags,
    prefix: getNpmScope(tree), // we could also allow customizing this
    projectName:
      isUsingTsSolutionsConfig && !options.name ? importPath : projectName,
    projectRoot,
    importPath,
    service: options.service ?? false,
    target: options.target ?? 'es6',
    testEnvironment: options.testEnvironment ?? 'node',
    unitTestRunner: options.unitTestRunner ?? 'jest',
    isUsingTsSolutionsConfig,
  };

  return normalized;
}

export function toJsLibraryGeneratorOptions(
  options: NormalizedOptions
): JsLibraryGeneratorSchema {
  return {
    name: options.name,
    bundler: options.buildable || options.publishable ? 'tsc' : 'none',
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
    setParserOptionsProject: options.setParserOptionsProject,
    addPlugin: options.addPlugin,
    useProjectJson: !options.isUsingTsSolutionsConfig,
  };
}
