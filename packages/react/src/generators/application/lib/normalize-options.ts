import { NormalizedSchema, Schema } from '../schema';
import { assertValidStyle } from '../../../utils/assertion';
import {
  extractLayoutDirectory,
  getWorkspaceLayout,
  names,
  normalizePath,
  Tree,
} from '@nx/devkit';
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

export function normalizeOptions<T extends Schema = Schema>(
  host: Tree,
  options: Schema
): NormalizedSchema<T> {
  const appDirectory = normalizeDirectory(options);
  const appProjectName = normalizeProjectName(options);
  const e2eProjectName = options.rootProject
    ? 'e2e'
    : `${names(options.name).fileName}-e2e`;

  const { layoutDirectory } = extractLayoutDirectory(options.directory);
  const appsDir = layoutDirectory ?? getWorkspaceLayout(host).appsDir;
  const appProjectRoot = options.rootProject
    ? '.'
    : normalizePath(`${appsDir}/${appDirectory}`);

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
