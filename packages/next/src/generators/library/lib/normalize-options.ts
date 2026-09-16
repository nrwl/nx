import { readNxJson, Tree } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/internal';
import { Schema } from '../schema';
import { normalizeLinterOption, isUsingTsSolutionSetup } from '@nx/js/internal';
import type { LinterType } from '@nx/js';

export interface NormalizedSchema extends Schema {
  // `normalizeOptions` always resolves this, so it is no longer optional.
  linter: LinterType;
  importPath: string;
  projectName: string;
  projectRoot: string;
  isUsingTsSolutionConfig: boolean;
}

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  await ensureRootProjectName(options, 'library');
  const { projectName, projectRoot, importPath } =
    await determineProjectNameAndRootOptions(host, {
      name: options.name,
      projectType: 'library',
      directory: options.directory,
      importPath: options.importPath,
    });

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
    linter: await normalizeLinterOption(host, options.linter),
    importPath,
    // Same rule as the React library generator, which registers the project.
    projectName:
      isUsingTsSolutionConfig && !options.name ? importPath : projectName,
    projectRoot,
    isUsingTsSolutionConfig,
    useProjectJson: options.useProjectJson ?? !isUsingTsSolutionConfig,
  };
}
