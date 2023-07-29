import type { LibraryGeneratorSchema as JsLibraryGeneratorSchema } from '@nx/js/src/utils/schema';
import { Linter } from '@nx/linter';
import {
  extractLayoutDirectory,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  Tree,
} from '@nx/devkit';
import type { LibraryGeneratorOptions, NormalizedOptions } from '../schema';
import { getNpmScope } from '@nx/js/src/utils/package-json/get-npm-scope';

export function normalizeOptions(
  tree: Tree,
  options: LibraryGeneratorOptions
): NormalizedOptions {
  const { layoutDirectory, projectDirectory } = extractLayoutDirectory(
    options.directory
  );
  const { libsDir: defaultLibsDir } = getWorkspaceLayout(tree);
  const libsDir = layoutDirectory ?? defaultLibsDir;
  const name = names(options.name).fileName;
  const fullProjectDirectory = projectDirectory
    ? `${names(projectDirectory).fileName}/${name}`
    : name;

  const projectName = fullProjectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = options.simpleName ? name : projectName;
  const projectRoot = joinPathFragments(libsDir, fullProjectDirectory);

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
    projectDirectory: fullProjectDirectory,
    projectName,
    projectRoot,
    service: options.service ?? false,
    target: options.target ?? 'es6',
    testEnvironment: options.testEnvironment ?? 'node',
    unitTestRunner: options.unitTestRunner ?? 'jest',
    libsDir,
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
    strict: options.strict,
    tags: options.tags,
    testEnvironment: options.testEnvironment,
    unitTestRunner: options.unitTestRunner,
    config: options.standaloneConfig ? 'project' : 'workspace',
    setParserOptionsProject: options.setParserOptionsProject,
  };
}
