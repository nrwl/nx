import { Tree, extractLayoutDirectory, names, readNxJson } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { assertValidStyle } from '../../../utils/assertion';
import { NormalizedSchema, Schema } from '../schema';
import { findFreePort } from './find-free-port';
import { VitePluginOptions } from '@nx/vite/src/plugins/plugin';
import { WebpackPluginOptions } from '@nx/webpack/src/plugins/plugin';

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
  const {
    projectName: appProjectName,
    projectRoot: appProjectRoot,
    projectNameAndRootFormat,
  } = await determineProjectNameAndRootOptions(host, {
    name: options.name,
    projectType: 'application',
    directory: options.directory,
    projectNameAndRootFormat: options.projectNameAndRootFormat,
    rootProject: options.rootProject,
    callingGenerator,
  });

  const nxJson = readNxJson(host);
  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  options.addPlugin ??= addPlugin;

  options.rootProject = appProjectRoot === '.';
  options.projectNameAndRootFormat = projectNameAndRootFormat;

  let e2eWebServerTarget = 'serve';
  if (options.addPlugin) {
    if (nxJson.plugins) {
      for (const plugin of nxJson.plugins) {
        if (
          options.bundler === 'vite' &&
          typeof plugin === 'object' &&
          plugin.plugin === '@nx/vite/plugin' &&
          (plugin.options as VitePluginOptions).serveTargetName
        ) {
          e2eWebServerTarget = (plugin.options as VitePluginOptions)
            .serveTargetName;
        } else if (
          options.bundler === 'webpack' &&
          typeof plugin === 'object' &&
          plugin.plugin === '@nx/webpack/plugin' &&
          (plugin.options as WebpackPluginOptions).serveTargetName
        ) {
          e2eWebServerTarget = (plugin.options as WebpackPluginOptions)
            .serveTargetName;
        }
      }
    }
  }

  let e2ePort = options.devServerPort ?? 4200;
  if (
    nxJson.targetDefaults?.[e2eWebServerTarget] &&
    nxJson.targetDefaults?.[e2eWebServerTarget].options?.port
  ) {
    e2ePort = nxJson.targetDefaults?.[e2eWebServerTarget].options?.port;
  }

  const e2eProjectName = options.rootProject ? 'e2e' : `${appProjectName}-e2e`;
  const e2eProjectRoot = options.rootProject ? 'e2e' : `${appProjectRoot}-e2e`;
  const e2eWebServerAddress = `http://localhost:${e2ePort}`;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const fileName = options.pascalCaseFiles ? 'App' : 'app';

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
    e2eWebServerAddress,
    e2eWebServerTarget,
    e2ePort,
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
  normalized.unitTestRunner = normalized.unitTestRunner ?? 'jest';
  normalized.e2eTestRunner = normalized.e2eTestRunner ?? 'playwright';
  normalized.inSourceTests = normalized.minimal || normalized.inSourceTests;
  normalized.devServerPort ??= findFreePort(host);
  normalized.minimal = normalized.minimal ?? false;

  return normalized;
}
