import { joinPathFragments, names, Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  className: string; // app name in class case
  fileName: string; // app name in file class
  projectName: string; // directory + app name in kebab case
  appProjectRoot: string; // app directory path
  lowerCaseName: string; // app name in lower case
  iosProjectRoot: string;
  androidProjectRoot: string;
  parsedTags: string[];
  entryFile: string;
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
    callingGenerator: '@nx/react-native:application',
  });
  options.projectNameAndRootFormat = projectNameAndRootFormat;
  options.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';

  const { className, fileName } = names(options.name);
  const iosProjectRoot = joinPathFragments(appProjectRoot, 'ios');
  const androidProjectRoot = joinPathFragments(appProjectRoot, 'android');
  const rootProject = appProjectRoot === '.';
  const e2eProjectName = rootProject ? 'e2e' : `${fileName}-e2e`;
  const e2eProjectRoot = rootProject ? 'e2e' : `${appProjectRoot}-e2e`;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const entryFile = options.js ? 'src/main.js' : 'src/main.tsx';

  return {
    ...options,
    name: projectNames.projectSimpleName,
    className,
    fileName,
    lowerCaseName: className.toLowerCase(),
    displayName: options.displayName || className,
    projectName: appProjectName,
    appProjectRoot,
    iosProjectRoot,
    androidProjectRoot,
    parsedTags,
    entryFile,
    rootProject,
    e2eProjectName,
    e2eProjectRoot,
  };
}
