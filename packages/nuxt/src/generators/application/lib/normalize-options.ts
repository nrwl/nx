import { Tree, extractLayoutDirectory, names, readNxJson } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { NormalizedSchema, Schema } from '../schema';
import { NuxtPluginOptions } from '../../../plugins/plugin';

export function normalizeDirectory(options: Schema) {
  options.directory = options.directory?.replace(/\\{1,2}/g, '/');
  const { projectDirectory } = extractLayoutDirectory(options.directory);
  return projectDirectory
    ? `${names(projectDirectory).fileName}/${names(options.name).fileName}`
    : names(options.name).fileName;
}

export async function normalizeOptions(
  host: Tree,
  options: Schema,
  callingGenerator = '@nx/nuxt:application'
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
    rootProject: options.rootProject,
    callingGenerator,
  });
  options.rootProject = appProjectRoot === '.';
  options.projectNameAndRootFormat = projectNameAndRootFormat;

  const nxJson = readNxJson(host);
  let e2eWebServerTarget = 'serve';
  if (nxJson.plugins) {
    for (const plugin of nxJson.plugins) {
      if (
        typeof plugin === 'object' &&
        plugin.plugin === '@nx/nuxt/plugin' &&
        (plugin.options as NuxtPluginOptions).serveTargetName
      ) {
        e2eWebServerTarget = (plugin.options as NuxtPluginOptions)
          .serveTargetName;
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
  const e2eProjectName = options.rootProject ? 'e2e' : `${appProjectName}-e2e`;
  const e2eProjectRoot = options.rootProject ? 'e2e' : `${appProjectRoot}-e2e`;
  const e2eWebServerAddress = `http://localhost:${e2ePort}`;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

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
    style: options.style ?? 'none',
  } as NormalizedSchema;

  normalized.unitTestRunner ??= 'vitest';
  normalized.e2eTestRunner = normalized.e2eTestRunner ?? 'playwright';

  return normalized;
}
