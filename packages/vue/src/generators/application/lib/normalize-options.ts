import { Tree } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/internal';
import { NormalizedSchema, Schema } from '../schema';
import { normalizeLinterOption, isUsingTsSolutionSetup } from '@nx/js/internal';

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  await ensureRootProjectName(options, 'application');
  const {
    projectName,
    projectRoot: appProjectRoot,
    importPath,
  } = await determineProjectNameAndRootOptions(host, {
    name: options.name,
    projectType: 'application',
    directory: options.directory,
    rootProject: options.rootProject,
  });
  options.rootProject = appProjectRoot === '.';

  const isUsingTsSolutionConfig = isUsingTsSolutionSetup(host);
  const appProjectName =
    !isUsingTsSolutionConfig || options.name ? projectName : importPath;

  const e2eProjectName = options.rootProject ? 'e2e' : `${appProjectName}-e2e`;
  const e2eProjectRoot = options.rootProject ? 'e2e' : `${appProjectRoot}-e2e`;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const normalized: NormalizedSchema = {
    ...options,
    projectName: appProjectName,
    appProjectRoot,
    importPath,
    e2eProjectName,
    e2eProjectRoot,
    parsedTags,
    isUsingTsSolutionConfig,
    useProjectJson: options.useProjectJson ?? !isUsingTsSolutionConfig,
    style: options.style ?? 'css',
    routing: options.routing ?? false,
    unitTestRunner: options.unitTestRunner ?? 'vitest',
    e2eTestRunner: options.e2eTestRunner ?? 'playwright',
    bundler: options.bundler ?? 'vite',
    // Resolved here rather than at the `addLinting` call, so the `=== 'eslint'`
    // check that builds the tsconfig excludes reads the same value.
    linter: await normalizeLinterOption(host, options.linter),
  };

  return normalized;
}
