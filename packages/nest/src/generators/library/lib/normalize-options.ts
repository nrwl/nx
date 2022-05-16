import type { Tree } from '@nrwl/devkit';
import { getWorkspaceLayout, joinPathFragments, names } from '@nrwl/devkit';
import type { LibraryGeneratorSchema as JsLibraryGeneratorSchema } from '@nrwl/js/src/utils/schema';
import { Linter } from '@nrwl/linter';
import type { LibraryGeneratorOptions, NormalizedOptions } from '../schema';

export function normalizeOptions(
  tree: Tree,
  options: LibraryGeneratorOptions
): NormalizedOptions {
  const { libsDir, npmScope } = getWorkspaceLayout(tree);
  const name = names(options.name).fileName;
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}/${name}`
    : name;

  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = options.simpleModuleName ? name : projectName;
  const projectRoot = joinPathFragments(libsDir, projectDirectory);
  const moduleName = options.simpleModuleName ? name : projectName;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const normalized: NormalizedOptions = {
    ...options,
    controller: options.controller ?? false,
    fileName,
    global: options.global ?? false,
    linter: options.linter ?? Linter.EsLint,
    parsedTags,
    prefix: npmScope, // we could also allow customizing this
    projectDirectory,
    projectName,
    projectRoot,
    moduleName,
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
    buildable: options.buildable,
    directory: options.directory,
    importPath: options.importPath,
    linter: options.linter,
    publishable: options.publishable,
    skipFormat: true,
    skipTsConfig: options.skipTsConfig,
    strict: options.strict,
    tags: options.tags,
    testEnvironment: options.testEnvironment,
    unitTestRunner: options.unitTestRunner,
    config: options.standaloneConfig ? 'project' : 'workspace',
    setParserOptionsProject: options.setParserOptionsProject,
  };
}
