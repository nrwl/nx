import { Tree, names, readNxJson } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { assertValidStyle } from '../../../utils/assertion';
import { NormalizedSchema, Schema } from '../schema';
import { findFreePort } from './find-free-port';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

export async function normalizeOptions<T extends Schema = Schema>(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema<T>> {
  await ensureRootProjectName(options, 'application');
  const {
    projectName: appProjectName,
    projectRoot: appProjectRoot,
    importPath,
  } = await determineProjectNameAndRootOptions(host, {
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

  const isUsingTsSolutionConfig = isUsingTsSolutionSetup(host);
  const normalized = {
    ...options,
    projectName:
      isUsingTsSolutionConfig &&
      !options.name &&
      !options.alwaysGenerateProjectJson
        ? importPath
        : appProjectName,
    appProjectRoot,
    e2eProjectName,
    e2eProjectRoot,
    parsedTags,
    fileName,
    styledModule,
    hasStyles: options.style !== 'none',
    names: names(appProjectName),
    isUsingTsSolutionConfig,
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
