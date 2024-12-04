import { Tree, extractLayoutDirectory, names, readNxJson } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { assertValidStyle } from '../../../utils/assertion';
import { NormalizedSchema, Schema } from '../schema';
import { findFreePort } from './find-free-port';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

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
  options: Schema
): Promise<NormalizedSchema<T>> {
  await ensureProjectName(host, options, 'application');
  const { projectName: appProjectName, projectRoot: appProjectRoot } =
    await determineProjectNameAndRootOptions(host, {
      name: options.name,
      projectType: 'application',
      directory: options.directory,
      rootProject: options.rootProject,
    });

  const nxJson = readNxJson(host);
  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  options.addPlugin ??= addPlugin;

  options.rootProject = appProjectRoot === '.';

  const e2eProjectName = options.rootProject ? 'e2e' : `${appProjectName}-e2e`;
  const e2eProjectRoot = options.rootProject ? 'e2e' : `${appProjectRoot}-e2e`;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const fileName = 'app';

  const styledModule = /^(css|scss|less|tailwind|none)$/.test(options.style)
    ? null
    : options.style;

  assertValidStyle(options.style);

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
    isUsingTsSolutionConfig: isUsingTsSolutionSetup(host),
  } as NormalizedSchema;

  normalized.routing = normalized.routing ?? false;
  normalized.strict = normalized.strict ?? true;
  normalized.classComponent = normalized.classComponent ?? false;
  normalized.compiler = normalized.compiler ?? 'babel';
  normalized.bundler = normalized.bundler ?? 'webpack';
  normalized.unitTestRunner = normalized.unitTestRunner ?? 'jest';
  normalized.e2eTestRunner = normalized.e2eTestRunner ?? 'playwright';
  normalized.inSourceTests = normalized.minimal || normalized.inSourceTests;
  normalized.devServerPort ??= findFreePort(host);
  normalized.minimal = normalized.minimal ?? false;

  return normalized;
}
