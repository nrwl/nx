import {
  getProjects,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  Tree,
} from '@nrwl/devkit';
import { Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  appFileName: string; // the file name of app to be tested
  appClassName: string; // the class name of app to be tested
  appDisplayName: string; // the display name of the app to be tested
  projectName: string; // the name of e2e project
  projectDirectory: string; // the directory of e2e project
  projectRoot: string; // the root path of e2e project
  appProjectRoot: string; // the root path of app to be tested
}

/**
 * if options.name = 'my-app-e2e' with no options.directory
 * projectName = 'my-app', projectRoot = 'apps/my-app'
 * if options.name = 'my-app' with options.directory = 'my-dir'
 * projectName = 'my-dir-my-app', projectRoot = 'apps/my-dir/my-apps'
 */
export function normalizeOptions(
  host: Tree,
  options: Schema
): NormalizedSchema {
  const { appsDir } = getWorkspaceLayout(host);
  const fileName = names(options.name).fileName;
  const directoryFileName = options.directory
    ? names(options.directory).fileName
    : '';
  const projectName = (
    directoryFileName ? `${directoryFileName}-${fileName}` : fileName
  ).replace(new RegExp('/', 'g'), '-');
  const projectDirectory = directoryFileName
    ? joinPathFragments(appsDir, directoryFileName)
    : appsDir;
  const projectRoot = joinPathFragments(projectDirectory, fileName);
  const project = getProjects(host).get(names(options.project).fileName);
  const appProjectRoot = project.root;

  const { fileName: appFileName } = names(options.project);

  return {
    ...options,
    appFileName,
    appDisplayName: options.displayName
      ? names(options.displayName).className
      : options.appClassName,
    name: fileName,
    projectName,
    projectDirectory,
    projectRoot,
    appProjectRoot,
  };
}
