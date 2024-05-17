import { Tree, names, readNxJson } from '@nx/devkit';
import { Schema, NormalizedSchema } from '../schema';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { VitePluginOptions } from '@nx/vite/src/plugins/plugin';
import { WebpackPluginOptions } from '@nx/webpack/src/plugins/plugin';
import { getNpmScope } from '@nx/js/src/utils/package-json/get-npm-scope';
import type { Linter } from '@nx/eslint';

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const {
    projectName: appProjectName,
    projectRoot: appProjectRoot,
    projectNameAndRootFormat,
  } = await determineProjectNameAndRootOptions(host, {
    name: options.name,
    projectType: 'application',
    directory: options.directory,
    projectNameAndRootFormat: options.projectNameAndRootFormat,
    callingGenerator: '@nx/web:application',
  });
  options.projectNameAndRootFormat = projectNameAndRootFormat;
  const nxJson = readNxJson(host);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  options.addPlugin ??= addPluginDefault;

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

  let e2ePort = 4200;
  if (
    nxJson.targetDefaults?.[e2eWebServerTarget] &&
    nxJson.targetDefaults?.[e2eWebServerTarget].options?.port
  ) {
    e2ePort = nxJson.targetDefaults?.[e2eWebServerTarget].options?.port;
  }

  const e2eProjectName = `${appProjectName}-e2e`;
  const e2eProjectRoot = `${appProjectRoot}-e2e`;
  const e2eWebServerAddress = `http://localhost:${e2ePort}`;

  const npmScope = getNpmScope(host);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  options.style = options.style || 'css';
  options.linter = options.linter || ('eslint' as Linter.EsLint);
  options.unitTestRunner = options.unitTestRunner || 'jest';
  options.e2eTestRunner = options.e2eTestRunner || 'playwright';

  return {
    ...options,
    prefix: options.prefix ?? npmScope ?? 'app',
    name: names(options.name).fileName,
    compiler: options.compiler ?? 'babel',
    bundler: options.bundler ?? 'webpack',
    strict: options.strict ?? true,
    projectName: appProjectName,
    appProjectRoot,
    e2eProjectRoot,
    e2eProjectName,
    e2eWebServerAddress,
    e2eWebServerTarget,
    e2ePort,
    parsedTags,
  };
}
