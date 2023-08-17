import { Tree, extractLayoutDirectory, names } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { assertValidStyle } from '../../../utils/assertion';
import { NormalizedSchema, Schema } from '../schema';
import { findFreePort } from './find-free-port';

export function normalizeDirectory(options: Schema) {
  options.directory = options.directory?.replace(/\\{1,2}/g, '/');
  const { projectDirectory } = extractLayoutDirectory(options.directory);
  return projectDirectory
    ? `${names(projectDirectory).fileName}/${names(options.name).fileName}`
    : names(options.name).fileName;
}

export function normalizeProjectName(options: Schema) {
  return normalizeDirectory(options).replace(new RegExp('/', 'g'), '-');
}

export async function normalizeOptions<T extends Schema = Schema>(
  host: Tree,
  options: Schema,
  callingGenerator = '@nx/react:application'
): Promise<NormalizedSchema<T>> {
  // TODO(leo): uncomment things below
  const {
    projectName: appProjectName,
    projectRoot: appProjectRoot,
    // projectNameAndRootFormat,
  } = await determineProjectNameAndRootOptions(host, {
    name: options.name,
    projectType: 'application',
    directory: options.directory,
    projectNameAndRootFormat: options.projectNameAndRootFormat,
    rootProject: options.rootProject,
    callingGenerator,
  });
  options.rootProject = appProjectRoot === '.';
  // options.projectNameAndRootFormat = projectNameAndRootFormat;

  let e2eProjectName = 'e2e';
  let e2eProjectRoot = 'e2e';
  if (!options.rootProject) {
    const projectNameAndRoot = await determineProjectNameAndRootOptions(host, {
      name: `${options.name}-e2e`,
      projectType: 'application',
      directory: options.directory,
      projectNameAndRootFormat: options.projectNameAndRootFormat,
      rootProject: options.rootProject,
      callingGenerator,
    });
    e2eProjectName = projectNameAndRoot.projectName;
    e2eProjectRoot = projectNameAndRoot.projectRoot;
  }

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const fileName = options.pascalCaseFiles ? 'App' : 'app';

  const styledModule = /^(css|scss|less|styl|none)$/.test(options.style)
    ? null
    : options.style;

  assertValidStyle(options.style);

  if (options.bundler === 'vite') {
    options.unitTestRunner = 'vitest';
  }

  const normalized = {
    ...options,
    name: names(options.name).fileName,
    projectName: appProjectName,
    appProjectRoot,
    e2eProjectName,
    e2eProjectRoot,
    parsedTags,
    fileName,
    styledModule,
    hasStyles: options.style !== 'none',
  } as NormalizedSchema;

  normalized.routing = normalized.routing ?? false;
  normalized.strict = normalized.strict ?? true;
  normalized.classComponent = normalized.classComponent ?? false;
  normalized.compiler = normalized.compiler ?? 'babel';
  normalized.bundler = normalized.bundler ?? 'webpack';
  normalized.unitTestRunner =
    normalized.unitTestRunner ??
    (normalized.bundler === 'vite' ? 'vitest' : 'jest');
  normalized.e2eTestRunner = normalized.e2eTestRunner ?? 'cypress';
  normalized.inSourceTests = normalized.minimal || normalized.inSourceTests;
  normalized.devServerPort ??= findFreePort(host);
  normalized.minimal = normalized.minimal ?? false;

  return normalized;
}
