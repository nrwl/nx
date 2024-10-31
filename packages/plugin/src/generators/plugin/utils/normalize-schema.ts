import { readNxJson, type Tree } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import { promptWhenInteractive } from '@nx/devkit/src/generators/prompt';
import type { LinterType } from '@nx/eslint';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import type { Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
  npmPackageName: string;
  bundler: 'swc' | 'tsc';
  publishable: boolean;
  unitTestRunner: 'jest' | 'none';
  linter: LinterType;
  useProjectJson: boolean;
  addPlugin: boolean;
  isTsSolutionSetup: boolean;
}

export async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const isTsSolutionSetup = isUsingTsSolutionSetup(host);

  let linter = options.linter;
  if (!linter) {
    const choices = isTsSolutionSetup
      ? [{ name: 'none' }, { name: 'eslint' }]
      : [{ name: 'eslint' }, { name: 'none' }];
    const defaultValue = isTsSolutionSetup ? 'none' : 'eslint';

    linter = await promptWhenInteractive<{
      linter: 'none' | 'eslint';
    }>(
      {
        type: 'select',
        name: 'linter',
        message: `Which linter would you like to use?`,
        choices,
        initial: 0,
      },
      { linter: defaultValue }
    ).then(({ linter }) => linter);
  }

  let unitTestRunner = options.unitTestRunner;
  if (!unitTestRunner) {
    const choices = isTsSolutionSetup
      ? [{ name: 'none' }, { name: 'jest' }]
      : [{ name: 'jest' }, { name: 'none' }];
    const defaultValue = isTsSolutionSetup ? 'none' : 'jest';

    unitTestRunner = await promptWhenInteractive<{
      unitTestRunner: 'none' | 'jest';
    }>(
      {
        type: 'select',
        name: 'unitTestRunner',
        message: `Which unit test runner would you like to use?`,
        choices,
        initial: 0,
      },
      { unitTestRunner: defaultValue }
    ).then(({ unitTestRunner }) => unitTestRunner);
  }

  const nxJson = readNxJson(host);
  const addPlugin =
    options.addPlugin ??
    (isTsSolutionSetup &&
      process.env.NX_ADD_PLUGINS !== 'false' &&
      nxJson.useInferencePlugins !== false);

  await ensureProjectName(host, options, 'application');
  const {
    projectName,
    projectRoot,
    importPath: npmPackageName,
  } = await determineProjectNameAndRootOptions(host, {
    name: options.name,
    projectType: 'library',
    directory: options.directory,
    importPath: options.importPath,
    rootProject: options.rootProject,
  });
  options.rootProject = projectRoot === '.';

  const projectDirectory = projectRoot;

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  return {
    ...options,
    bundler: options.compiler ?? 'tsc',
    fileName: projectName,
    name: projectName,
    projectRoot,
    projectDirectory,
    parsedTags,
    npmPackageName,
    publishable: options.publishable ?? false,
    linter,
    unitTestRunner,
    // We default to generate a project.json file if the new setup is not being used
    useProjectJson: options.useProjectJson ?? !isTsSolutionSetup,
    addPlugin,
    isTsSolutionSetup,
  };
}
