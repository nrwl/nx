import { readNxJson, type Tree } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureProjectName,
} from '@nx/devkit/src/generators/project-name-and-root-utils';
import type { LinterType } from '@nx/eslint';
import {
  normalizeLinterOption,
  normalizeUnitTestRunnerOption,
} from '@nx/js/src/utils/generator-prompts';
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
  const linter = await normalizeLinterOption(host, options.linter);
  const unitTestRunner = await normalizeUnitTestRunnerOption(
    host,
    options.unitTestRunner,
    ['jest']
  );

  const isTsSolutionSetup = isUsingTsSolutionSetup(host);
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
