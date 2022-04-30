import { NormalizedSchema, Schema } from '../schema';
import { assertValidStyle } from '../../../utils/assertion';
import { getWorkspaceLayout, names, normalizePath, Tree } from '@nrwl/devkit';
import { findFreePort } from './find-free-port';

export function normalizeDirectory(options: Schema) {
  return options.directory
    ? `${names(options.directory).fileName}/${names(options.name).fileName}`
    : names(options.name).fileName;
}

export function normalizeProjectName(options: Schema) {
  return normalizeDirectory(options).replace(new RegExp('/', 'g'), '-');
}

export function normalizeOptions(
  host: Tree,
  options: Schema
): NormalizedSchema {
  const appDirectory = normalizeDirectory(options);
  const appProjectName = normalizeProjectName(options);
  const e2eProjectName = `${appProjectName}-e2e`;

  const { appsDir } = getWorkspaceLayout(host);
  const appProjectRoot = normalizePath(`${appsDir}/${appDirectory}`);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const fileName = options.pascalCaseFiles ? 'App' : 'app';

  const styledModule = /^(css|scss|less|styl|none)$/.test(options.style)
    ? null
    : options.style;

  assertValidStyle(options.style);

  options.routing = options.routing ?? false;
  options.strict = options.strict ?? true;
  options.classComponent = options.classComponent ?? false;
  options.unitTestRunner = options.unitTestRunner ?? 'jest';
  options.e2eTestRunner = options.e2eTestRunner ?? 'cypress';
  options.compiler = options.compiler ?? 'babel';
  options.devServerPort ??= findFreePort(host);

  return {
    ...options,
    name: names(options.name).fileName,
    projectName: appProjectName,
    appProjectRoot,
    e2eProjectName,
    parsedTags,
    fileName,
    styledModule,
    hasStyles: options.style !== 'none',
  };
}
