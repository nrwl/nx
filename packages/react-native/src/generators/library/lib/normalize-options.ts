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
  name: string;
  fileName: string;
  projectRoot: string;
  importPath: string;
  routePath: string;
  parsedTags: string[];
  appMain?: string;
  appSourceRoot?: string;
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
  const normalized: NormalizedSchema = {
    ...options,
    // Resolved in the literal so the type guarantees it: `undefined` is falsy,
    // so the ESLint arm would still run while the `=== 'eslint'` tsconfig
    // excludes below are skipped.
    linter: await normalizeLinterOption(host, options.linter),
    fileName: projectName,
    routePath: `/${projectNames.projectSimpleName}`,
    name: isUsingTsSolutionConfig && !options.name ? importPath : projectName,
    projectRoot,
    parsedTags,
    importPath,
    isUsingTsSolutionConfig,
    useProjectJson: options.useProjectJson ?? !isUsingTsSolutionConfig,
  };

  return normalized;
}
