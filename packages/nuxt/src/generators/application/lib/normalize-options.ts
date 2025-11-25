import { names, Tree } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { NormalizedSchema, Schema } from '../schema';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { getNuxtDependenciesVersionsToInstall } from '../../../utils/version-utils';

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  await ensureRootProjectName(options, 'application');
  const {
    projectName,
    names: projectNames,
    projectRoot: appProjectRoot,
    importPath,
  } = await determineProjectNameAndRootOptions(host, {
    name: options.name,
    projectType: 'application',
    directory: options.directory,
    rootProject: options.rootProject,
  });
  options.rootProject = appProjectRoot === '.';

  const isUsingTsSolutionConfig = isUsingTsSolutionSetup(host);
  const appProjectName =
    !isUsingTsSolutionConfig || options.name ? projectName : importPath;

  const e2eProjectName = options.rootProject ? 'e2e' : `${appProjectName}-e2e`;
  const e2eProjectRoot = options.rootProject ? 'e2e' : `${appProjectRoot}-e2e`;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  // Detect workspace Nuxt version
  const nuxtVersions = await getNuxtDependenciesVersionsToInstall(host);
  const nuxtMajorVersion: 3 | 4 = nuxtVersions.nuxt.startsWith('^4') ? 4 : 3;

  // Set useAppDir default based on version (v4 defaults to true, v3 defaults to false)
  const useAppDir = options.useAppDir ?? nuxtMajorVersion >= 4;

  const normalized = {
    ...options,
    name: projectNames.projectFileName,
    projectName: appProjectName,
    appProjectRoot,
    importPath,
    e2eProjectName,
    e2eProjectRoot,
    parsedTags,
    style: options.style ?? 'none',
    isUsingTsSolutionConfig,
    useProjectJson: options.useProjectJson ?? !isUsingTsSolutionConfig,
    useAppDir,
    nuxtMajorVersion,
  } as NormalizedSchema;

  normalized.unitTestRunner ??= 'vitest';
  normalized.e2eTestRunner = normalized.e2eTestRunner ?? 'playwright';

  return normalized;
}
