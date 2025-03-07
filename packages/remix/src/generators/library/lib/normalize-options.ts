import { readNxJson, type Tree } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import type { NxRemixGeneratorSchema } from '../schema';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

export interface RemixLibraryOptions extends NxRemixGeneratorSchema {
  projectName: string;
  projectRoot: string;
  isUsingTsSolutionConfig: boolean;
}

export async function normalizeOptions(
  tree: Tree,
  options: NxRemixGeneratorSchema
): Promise<RemixLibraryOptions> {
  await ensureRootProjectName(options, 'application');
  const { projectName, projectRoot, importPath } =
    await determineProjectNameAndRootOptions(tree, {
      name: options.name,
      projectType: 'library',
      directory: options.directory,
    });

  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  options.addPlugin ??= addPluginDefault;

  const isUsingTsSolutionConfig = isUsingTsSolutionSetup(tree);
  return {
    ...options,
    unitTestRunner: options.unitTestRunner ?? 'vitest',
    projectName:
      isUsingTsSolutionConfig && !options.name ? importPath : projectName,
    projectRoot,
    importPath,
    isUsingTsSolutionConfig,
  };
}
