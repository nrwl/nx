import { readNxJson, Tree } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { Schema } from '../schema';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

export interface NormalizedSchema extends Schema {
  importPath: string;
  projectRoot: string;
  isUsingTsSolutionConfig: boolean;
}

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  await ensureRootProjectName(options, 'library');
  const { projectRoot, importPath } = await determineProjectNameAndRootOptions(
    host,
    {
      name: options.name,
      projectType: 'library',
      directory: options.directory,
      importPath: options.importPath,
    }
  );

  const nxJson = readNxJson(host);
  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  options.addPlugin ??= addPlugin;

  return {
    ...options,
    importPath,
    projectRoot,
    isUsingTsSolutionConfig: isUsingTsSolutionSetup(host),
  };
}
