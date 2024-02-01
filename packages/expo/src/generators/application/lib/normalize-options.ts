import { names, Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  className: string;
  projectName: string;
  appProjectRoot: string;
  lowerCaseName: string;
  parsedTags: string[];
  rootProject: boolean;
  e2eProjectName: string;
  e2eProjectRoot: string;
}

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const {
    projectName: appProjectName,
    names: projectNames,
    projectRoot: appProjectRoot,
    projectNameAndRootFormat,
  } = await determineProjectNameAndRootOptions(host, {
    name: options.name,
    projectType: 'application',
    directory: options.directory,
    projectNameAndRootFormat: options.projectNameAndRootFormat,
    callingGenerator: '@nx/expo:application',
  });
  options.projectNameAndRootFormat = projectNameAndRootFormat;
  options.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';

  const { className } = names(options.name);
  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];
  const rootProject = appProjectRoot === '.';
  const e2eProjectName = rootProject ? 'e2e' : `${appProjectName}-e2e`;
  const e2eProjectRoot = rootProject ? 'e2e' : `${appProjectRoot}-e2e`;

  return {
    ...options,
    unitTestRunner: options.unitTestRunner || 'jest',
    e2eTestRunner: options.e2eTestRunner,
    name: projectNames.projectSimpleName,
    className,
    lowerCaseName: className.toLowerCase(),
    displayName: options.displayName || className,
    projectName: appProjectName,
    appProjectRoot,
    parsedTags,
    rootProject,
    e2eProjectName,
    e2eProjectRoot,
  };
}
