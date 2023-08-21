import { joinPathFragments, names, Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { Linter } from '@nx/linter';
import { assertValidStyle } from '@nx/react/src/utils/assertion';
import { Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  projectName: string;
  appProjectRoot: string;
  outputPath: string;
  e2eProjectName: string;
  e2eProjectRoot: string;
  parsedTags: string[];
  fileName: string;
  styledModule: null | string;
  js?: boolean;
}

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
    rootProject: options.rootProject,
    callingGenerator: '@nx/next:application',
  });
  options.rootProject = appProjectRoot === '.';
  options.projectNameAndRootFormat = projectNameAndRootFormat;

  let e2eProjectName = 'e2e';
  let e2eProjectRoot = 'e2e';
  if (!options.rootProject) {
    const projectNameAndRoot = await determineProjectNameAndRootOptions(host, {
      name: `${options.name}-e2e`,
      projectType: 'application',
      directory: options.directory,
      projectNameAndRootFormat: options.projectNameAndRootFormat,
      rootProject: options.rootProject,
      callingGenerator: '@nx/next:application',
    });
    e2eProjectName = projectNameAndRoot.projectName;
    e2eProjectRoot = projectNameAndRoot.projectRoot;
  }

  const name = names(options.name).fileName;

  const outputPath = joinPathFragments(
    'dist',
    appProjectRoot,
    ...(options.rootProject ? [name] : [])
  );

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const fileName = 'index';

  const appDir = options.appDir ?? true;

  const styledModule = /^(css|scss|less|styl)$/.test(options.style)
    ? null
    : options.style;

  assertValidStyle(options.style);

  return {
    ...options,
    appDir,
    appProjectRoot,
    e2eProjectName,
    e2eProjectRoot,
    e2eTestRunner: options.e2eTestRunner || 'cypress',
    fileName,
    linter: options.linter || Linter.EsLint,
    name,
    outputPath,
    parsedTags,
    projectName: appProjectName,
    style: options.style || 'css',
    styledModule,
    unitTestRunner: options.unitTestRunner || 'jest',
  };
}
