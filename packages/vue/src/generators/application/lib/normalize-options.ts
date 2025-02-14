import { Tree } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { NormalizedSchema, Schema } from '../schema';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { getImportPath } from '@nx/js/src/utils/get-import-path';

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  await ensureProjectName(host, options, 'application');
  const { projectName: appProjectName, projectRoot: appProjectRoot } =
    await determineProjectNameAndRootOptions(host, {
      name: options.name,
      projectType: 'application',
      directory: options.directory,
      rootProject: options.rootProject,
    });
  options.rootProject = appProjectRoot === '.';

  const e2eProjectName = options.rootProject ? 'e2e' : `${appProjectName}-e2e`;
  const e2eProjectRoot = options.rootProject ? 'e2e' : `${appProjectRoot}-e2e`;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const isUsingTsSolutionConfig = isUsingTsSolutionSetup(host);

  const normalized = {
    ...options,
    projectName: isUsingTsSolutionConfig
      ? getImportPath(host, appProjectName)
      : appProjectName,
    appProjectRoot,
    e2eProjectName,
    e2eProjectRoot,
    parsedTags,
    isUsingTsSolutionConfig,
  } as NormalizedSchema;

  normalized.style = options.style ?? 'css';
  normalized.routing = normalized.routing ?? false;
  normalized.unitTestRunner ??= 'vitest';
  normalized.e2eTestRunner = normalized.e2eTestRunner ?? 'playwright';
  normalized.bundler = normalized.bundler ?? 'vite';

  return normalized;
}
