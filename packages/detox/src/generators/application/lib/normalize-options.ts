import { names, readProjectConfiguration, Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  appFileName: string; // the file name of app to be tested
  appClassName: string; // the class name of app to be tested
  appExpoName: string; // the expo name of app to be tested in class case
  appRoot: string; // the root path of e2e project. e.g. apps/app-directory/app
  e2eProjectName: string; // the name of e2e project
  e2eProjectRoot: string; // the root path of e2e project. e.g. apps/e2e-directory/e2e-app
}

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const { projectName: e2eProjectName, projectRoot: e2eProjectRoot } =
    await determineProjectNameAndRootOptions(host, {
      name: options.e2eName,
      projectType: 'application',
      directory: options.e2eDirectory,
      projectNameAndRootFormat: options.projectNameAndRootFormat,
      callingGenerator: '@nx/detox:application',
    });

  options.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';

  const { fileName: appFileName, className: appClassName } = names(
    options.appName || options.appProject
  );
  const { root: appRoot } = readProjectConfiguration(
    host,
    names(options.appProject).fileName
  );

  return {
    ...options,
    appFileName,
    appClassName,
    appDisplayName: options.appDisplayName || appClassName,
    appExpoName: options.appDisplayName?.replace(/\s/g, '') || appClassName,
    appRoot,
    e2eName: e2eProjectName,
    e2eProjectName,
    e2eProjectRoot,
  };
}
