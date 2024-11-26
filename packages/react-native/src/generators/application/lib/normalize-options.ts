import { joinPathFragments, names, readNxJson, Tree } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  className: string; // app name in class case
  fileName: string; // app name in file class
  projectName: string; // directory + app name, case based on user input
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
  await ensureProjectName(host, options, 'application');
  const {
    projectName: appProjectName,
    names: projectNames,
    projectRoot: appProjectRoot,
  } = await determineProjectNameAndRootOptions(host, {
    name: options.name,
    projectType: 'application',
    directory: options.directory,
  });
  const nxJson = readNxJson(host);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  options.addPlugin ??= addPluginDefault;

  const { className, fileName } = names(options.name);
  const iosProjectRoot = joinPathFragments(appProjectRoot, 'ios');
  const androidProjectRoot = joinPathFragments(appProjectRoot, 'android');
  const rootProject = appProjectRoot === '.';

  const e2eProjectName = rootProject ? 'e2e' : `${appProjectName}-e2e`;
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
