import { names, readNxJson, readProjectConfiguration, Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { Schema } from '../schema';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

export interface NormalizedSchema extends Omit<Schema, 'e2eName'> {
  appFileName: string; // the file name of app to be tested in kebab case
  appClassName: string; // the class name of app to be tested in pascal case
  appExpoName: string; // the expo name of app to be tested in class case
  appRoot: string; // the root path of e2e project. e.g. apps/app-directory/app
  e2eProjectName: string; // the name of e2e project
  e2eProjectRoot: string; // the root path of e2e project. e.g. apps/e2e-directory/e2e-app
  importPath: string;
  isUsingTsSolutionConfig?: boolean;
}

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const {
    projectName,
    projectRoot: e2eProjectRoot,
    importPath,
  } = await determineProjectNameAndRootOptions(host, {
    name: options.e2eName,
    projectType: 'application',
    directory: options.e2eDirectory,
  });
  const nxJson = readNxJson(host);
  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  options.addPlugin ??= addPlugin;

  const { fileName: appFileName, className: appClassName } = names(
    options.appName || options.appProject
  );
  const { root: appRoot } = readProjectConfiguration(host, options.appProject);

  const isUsingTsSolutionConfig = isUsingTsSolutionSetup(host);
  const e2eProjectName =
    !isUsingTsSolutionConfig || options.e2eName ? projectName : importPath;
  // We default to generate a project.json file if the new setup is not being used
  const useProjectJson = options.useProjectJson ?? !isUsingTsSolutionConfig;

  return {
    ...options,
    appFileName,
    appClassName,
    appDisplayName: options.appDisplayName || appClassName,
    appExpoName: options.appDisplayName?.replace(/\s/g, '') || appClassName,
    appRoot,
    e2eProjectName,
    e2eProjectRoot,
    importPath,
    isUsingTsSolutionConfig,
    js: options.js ?? false,
    useProjectJson,
  };
}
