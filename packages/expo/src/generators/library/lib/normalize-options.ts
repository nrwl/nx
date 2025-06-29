import { readNxJson, Tree } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { Schema } from '../schema';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

export interface NormalizedSchema extends Omit<Schema, 'name'> {
  fileName: string;
  projectName: string;
  projectRoot: string;
  importPath: string;
  routePath: string;
  parsedTags: string[];
  isUsingTsSolutionConfig: boolean;
}

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  await ensureRootProjectName(options, 'library');
  const {
    projectName,
    names: projectNames,
    projectRoot,
    importPath,
  } = await determineProjectNameAndRootOptions(host, {
    name: options.name,
    projectType: 'library',
    directory: options.directory,
    importPath: options.importPath,
  });
  const nxJson = readNxJson(host);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  options.addPlugin ??= addPluginDefault;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const isUsingTsSolutionConfig = isUsingTsSolutionSetup(host);
  const useProjectJson = options.useProjectJson ?? !isUsingTsSolutionConfig;

  const normalized: NormalizedSchema = {
    ...options,
    fileName: projectName,
    routePath: `/${projectNames.projectSimpleName}`,
    projectName:
      isUsingTsSolutionConfig && !options.name ? importPath : projectName,
    projectRoot,
    parsedTags,
    importPath,
    isUsingTsSolutionConfig,
    useProjectJson,
    unitTestRunner: options.unitTestRunner ?? 'none',
  };

  return normalized;
}
