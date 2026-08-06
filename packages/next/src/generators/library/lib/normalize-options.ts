import { readNxJson, Tree } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/internal';
import { Schema } from '../schema';
import { detectLinter, isUsingTsSolutionSetup } from '@nx/js/internal';

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
  const isUsingTsSolutionConfig = isUsingTsSolutionSetup(host);

  return {
    ...options,
    // Resolved after the spread: the framework's ESLint shaping is guarded on
    // `=== 'eslint'`, and an unresolved `undefined` would skip all of it.
    linter: options.linter ?? detectLinter(host),
    importPath,
    projectRoot,
    isUsingTsSolutionConfig,
    useProjectJson: options.useProjectJson ?? !isUsingTsSolutionConfig,
  };
}
