import { names, readNxJson, Tree } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/internal';
import { normalizeLinterOption, isUsingTsSolutionSetup } from '@nx/js/internal';
import { Schema } from '../schema';
import type { LinterType } from '@nx/js';

export interface NormalizedSchema extends Omit<
  Schema,
  'name' | 'useTsSolution'
> {
  // `normalizeOptions` always resolves this, so it is no longer optional.
  linter: LinterType;
  className: string;
  simpleName: string;
  projectName: string;
  appProjectRoot: string;
  importPath: string;
  lowerCaseName: string;
  parsedTags: string[];
  rootProject: boolean;
  e2eProjectName: string;
  e2eProjectRoot: string;
  isTsSolutionSetup: boolean;
}

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  await ensureRootProjectName(options, 'application');
  const {
    projectName,
    names: projectNames,
    projectRoot: appProjectRoot,
    importPath,
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

  const { className } = names(projectName);
  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];
  const rootProject = appProjectRoot === '.';

  const isTsSolutionSetup = isUsingTsSolutionSetup(host);
  const appProjectName =
    !isTsSolutionSetup || options.name ? projectName : importPath;
  const useProjectJson = options.useProjectJson ?? !isTsSolutionSetup;

  const e2eProjectName = rootProject ? 'e2e' : `${appProjectName}-e2e`;
  const e2eProjectRoot = rootProject ? 'e2e' : `${appProjectRoot}-e2e`;

  return {
    ...options,
    // Resolved after the spread: `undefined` is falsy, so the ESLint arm in
    // add-linting would still run while the `=== 'eslint'` tsconfig excludes
    // below are skipped.
    linter: await normalizeLinterOption(host, options.linter),
    unitTestRunner: options.unitTestRunner || 'jest',
    e2eTestRunner: options.e2eTestRunner || 'none',
    simpleName: projectNames.projectSimpleName,
    className,
    lowerCaseName: className.toLowerCase(),
    displayName: options.displayName || className,
    projectName: appProjectName,
    appProjectRoot,
    importPath,
    parsedTags,
    rootProject,
    e2eProjectName,
    e2eProjectRoot,
    isTsSolutionSetup,
    useProjectJson,
  };
}
