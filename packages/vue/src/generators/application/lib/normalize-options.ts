import { Tree, extractLayoutDirectory, names } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { NormalizedSchema, Schema } from '../schema';

export async function normalizeOptions(
  host: Tree,
  options: Schema,
  callingGenerator = '@nx/vue:application'
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

  const e2eProjectName = options.rootProject ? 'e2e' : `${appProjectName}-e2e`;
  const e2eProjectRoot = options.rootProject ? 'e2e' : `${appProjectRoot}-e2e`;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const normalized = {
    ...options,
    projectName: appProjectName,
    appProjectRoot,
    e2eProjectName,
    e2eProjectRoot,
    parsedTags,
  } as NormalizedSchema;

  normalized.style = options.style ?? 'css';
  normalized.routing = normalized.routing ?? false;
  normalized.unitTestRunner ??= 'vitest';
  normalized.e2eTestRunner = normalized.e2eTestRunner ?? 'playwright';

  return normalized;
}
