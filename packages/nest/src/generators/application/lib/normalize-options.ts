import { Tree, readNxJson } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/internal';
import { isTypedLintingEnabled } from '@nx/eslint/internal';
import { isUsingTsSolutionSetup, normalizeLinterOption } from '@nx/js/internal';
import type { Schema as NodeApplicationGeneratorOptions } from '@nx/node/internal';
import { getDefaultBundler } from '../../../utils/default-bundler';
import { getDefaultUnitTestRunner } from '../../../utils/default-unit-test-runner';
import type { ApplicationGeneratorOptions, NormalizedOptions } from '../schema';

export async function normalizeOptions(
  tree: Tree,
  options: ApplicationGeneratorOptions
): Promise<NormalizedOptions> {
  await ensureRootProjectName(options, 'application');
  const { projectName: appProjectName, projectRoot: appProjectRoot } =
    await determineProjectNameAndRootOptions(tree, {
      name: options.name,
      projectType: 'application',
      directory: options.directory,
      rootProject: options.rootProject,
    });
  options.rootProject = appProjectRoot === '.';

  const nxJson = readNxJson(tree);
  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  return {
    addPlugin,
    ...options,
    strict: options.strict ?? false,
    appProjectName,
    appProjectRoot,
    linter: await normalizeLinterOption(tree, options.linter),
    unitTestRunner: options.unitTestRunner ?? getDefaultUnitTestRunner(tree),
    e2eTestRunner: options.e2eTestRunner ?? 'jest',
    bundler: options.bundler ?? getDefaultBundler(tree),
    useProjectJson: options.useProjectJson ?? !isUsingTsSolutionSetup(tree),
  };
}

export function toNodeApplicationGeneratorOptions(
  options: NormalizedOptions
): NodeApplicationGeneratorOptions {
  return {
    name: options.name,
    directory: options.directory,
    frontendProject: options.frontendProject,
    linter: options.linter,
    formatter: options.formatter,
    skipFormat: true,
    skipPackageJson: options.skipPackageJson,
    tags: options.tags,
    unitTestRunner: options.unitTestRunner,
    e2eTestRunner: options.e2eTestRunner,
    enableTypedLinting: isTypedLintingEnabled(options),
    rootProject: options.rootProject,
    bundler: options.bundler,
    isNest: true,
    addPlugin: options.addPlugin,
    useProjectJson: options.useProjectJson,
  };
}
