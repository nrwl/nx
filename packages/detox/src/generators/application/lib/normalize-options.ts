import {
  getProjects,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  Tree,
} from '@nx/devkit';
import { Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  appFileName: string; // the file name of app to be tested
  appClassName: string; // the class name of app to be tested
  appExpoName: string; // the expo name of app to be tested in class case
  appRoot: string; // the root path of e2e project. e.g. apps/app-directory/app
  e2eProjectName: string; // the name of e2e project
  e2eProjectDirectory: string; // root path the directory of e2e project directory. e,g. apps/e2e-directory
  e2eProjectRoot: string; // the root path of e2e project. e.g. apps/e2e-directory/e2e-app
}

/**
 * if options.e2eName = 'my-app-e2e' with no options.directory
 * e2eProjectName = 'my-app', e2eProjectRoot = 'apps/my-app'
 * if options.e2eName = 'my-app' with options.e2eDirectory = 'my-dir'
 * e2eProjectName = 'my-dir-my-app', e2eProjectRoot = 'apps/my-dir/my-apps'
 */
export function normalizeOptions(
  host: Tree,
  options: Schema
): NormalizedSchema {
  const { appsDir } = getWorkspaceLayout(host);
  const e2eFileName = names(options.e2eName).fileName;
  const e2eDirectoryFileName = options.e2eDirectory
    ? names(options.e2eDirectory).fileName
    : '';
  const e2eProjectName = (
    e2eDirectoryFileName
      ? `${e2eDirectoryFileName}-${e2eFileName}`
      : e2eFileName
  ).replace(/\//g, '-');
  const e2eProjectDirectory = e2eDirectoryFileName
    ? joinPathFragments(appsDir, e2eDirectoryFileName)
    : appsDir;
  const e2eProjectRoot = joinPathFragments(e2eProjectDirectory, e2eFileName);

  const { fileName: appFileName, className: appClassName } = names(
    options.appName || options.appProject
  );
  const project = getProjects(host).get(options.appProject);
  const appRoot =
    project?.root || joinPathFragments(e2eProjectDirectory, appFileName);

  return {
    ...options,
    appFileName,
    appClassName,
    appDisplayName: options.appDisplayName || appClassName,
    appExpoName: options.appDisplayName?.replace(/\s/g, '') || appClassName,
    appRoot,
    e2eName: e2eFileName,
    e2eProjectName,
    e2eProjectDirectory,
    e2eProjectRoot,
  };
}
