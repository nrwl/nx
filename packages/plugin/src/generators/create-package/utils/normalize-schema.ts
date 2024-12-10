import { readNxJson, Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import type { LinterType } from '@nx/eslint';
import {
  normalizeLinterOption,
  normalizeUnitTestRunnerOption,
} from '@nx/js/src/utils/generator-prompts';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { CreatePackageSchema } from '../schema';

export interface NormalizedSchema extends CreatePackageSchema {
  bundler: 'swc' | 'tsc';
  projectName: string;
  projectRoot: string;
  unitTestRunner: 'jest' | 'vitest' | 'none';
  linter: LinterType;
  useProjectJson: boolean;
  addPlugin: boolean;
  isTsSolutionSetup: boolean;
}

export async function normalizeSchema(
  host: Tree,
  schema: CreatePackageSchema
): Promise<NormalizedSchema> {
  const linter = await normalizeLinterOption(host, schema.linter);
  const unitTestRunner = await normalizeUnitTestRunnerOption(
    host,
    schema.unitTestRunner,
    ['jest']
  );

  if (!schema.directory) {
    throw new Error(
      `Please provide the --directory option. It should be the directory containing the project '${schema.project}'.`
    );
  }
  const {
    projectName,
    names: projectNames,
    projectRoot,
  } = await determineProjectNameAndRootOptions(host, {
    name: schema.name,
    projectType: 'library',
    directory: schema.directory,
  });

  const isTsSolutionSetup = isUsingTsSolutionSetup(host);
  const nxJson = readNxJson(host);
  const addPlugin =
    schema.addPlugin ??
    (isTsSolutionSetup &&
      process.env.NX_ADD_PLUGINS !== 'false' &&
      nxJson.useInferencePlugins !== false);

  return {
    ...schema,
    bundler: schema.compiler ?? 'tsc',
    projectName,
    projectRoot,
    name: projectNames.projectSimpleName,
    linter,
    unitTestRunner,
    // We default to generate a project.json file if the new setup is not being used
    useProjectJson: schema.useProjectJson ?? !isTsSolutionSetup,
    addPlugin,
    isTsSolutionSetup,
  };
}
