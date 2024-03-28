import { joinPathFragments, names, readNxJson, Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { Schema } from '../schema';
import { ReactNativePluginOptions } from '../../../../plugins/plugin';

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
  e2eWebServerAddress: string;
  e2eWebServerTarget: string;
  e2ePort: number;
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
  const nxJson = readNxJson(host);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  options.addPlugin ??= addPluginDefault;

  const { className, fileName } = names(options.name);
  const iosProjectRoot = joinPathFragments(appProjectRoot, 'ios');
  const androidProjectRoot = joinPathFragments(appProjectRoot, 'android');
  const rootProject = appProjectRoot === '.';

  let e2eWebServerTarget = 'start';
  if (options.addPlugin) {
    if (nxJson.plugins) {
      for (const plugin of nxJson.plugins) {
        if (
          options.bundler === 'vite' &&
          typeof plugin === 'object' &&
          plugin.plugin === '@nx/react-native/plugin' &&
          (plugin.options as ReactNativePluginOptions).startTargetName
        ) {
          e2eWebServerTarget = (plugin.options as ReactNativePluginOptions)
            .startTargetName;
        }
      }
    }
  }

  let e2ePort = 4200;
  if (
    nxJson.targetDefaults?.[e2eWebServerTarget] &&
    nxJson.targetDefaults?.[e2eWebServerTarget].options?.port
  ) {
    e2ePort = nxJson.targetDefaults?.[e2eWebServerTarget].options?.port;
  }

  const e2eProjectName = rootProject ? 'e2e' : `${fileName}-e2e`;
  const e2eProjectRoot = rootProject ? 'e2e' : `${appProjectRoot}-e2e`;
  const e2eWebServerAddress = `http://localhost:${e2ePort}`;

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
    e2eWebServerAddress,
    e2eWebServerTarget,
    e2ePort,
  };
}
