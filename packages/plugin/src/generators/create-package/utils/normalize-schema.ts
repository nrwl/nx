import { readNxJson, Tree } from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { promptWhenInteractive } from '@nx/devkit/src/generators/prompt';
import type { LinterType } from '@nx/eslint';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { CreatePackageSchema } from '../schema';

export interface NormalizedSchema extends CreatePackageSchema {
  bundler: 'swc' | 'tsc';
  projectName: string;
  projectRoot: string;
  unitTestRunner: 'jest' | 'none';
  linter: LinterType;
  useProjectJson: boolean;
  addPlugin: boolean;
  isTsSolutionSetup: boolean;
}

export async function normalizeSchema(
  host: Tree,
  schema: CreatePackageSchema
): Promise<NormalizedSchema> {
  const isTsSolutionSetup = isUsingTsSolutionSetup(host);

  let linter = schema.linter;
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

  let unitTestRunner = schema.unitTestRunner;
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
