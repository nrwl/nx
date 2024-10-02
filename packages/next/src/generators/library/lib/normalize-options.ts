import { readNxJson, Tree } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  importPath: string;
  projectRoot: string;
}

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  await ensureProjectName(host, options, 'library');
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
  };
}
