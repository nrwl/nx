import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  logger,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

import { cypressProjectGenerator } from '../cypress-project/cypress-project';
import { StorybookConfigureSchema } from './schema';
import { initGenerator } from '../init/init';

import {
  addAngularStorybookTask,
  addStorybookTask,
  configureTsProjectConfig,
  configureTsSolutionConfig,
  createProjectStorybookDir,
  createRootStorybookDir,
  updateLintConfig,
} from './util-functions';
import { Linter } from '@nrwl/linter';
import { findStorybookAndBuildTargetsAndCompiler } from '../../utils/utilities';
import {
  storybookNextAddonVersion,
  storybookSwcAddonVersion,
} from '../../utils/versions';

export async function configurationGenerator(
  tree: Tree,
  rawSchema: StorybookConfigureSchema
) {
  const schema = normalizeSchema(rawSchema);

  const tasks: GeneratorCallback[] = [];

  const { projectType, targets } = readProjectConfiguration(tree, schema.name);
  const { nextBuildTarget, compiler } =
    findStorybookAndBuildTargetsAndCompiler(targets);

  const initTask = await initGenerator(tree, {
    uiFramework: schema.uiFramework,
  });
  tasks.push(initTask);

  createRootStorybookDir(tree, schema.js, schema.tsConfiguration);
  createProjectStorybookDir(
    tree,
    schema.name,
    schema.uiFramework,
    schema.js,
    schema.tsConfiguration,
    !!nextBuildTarget,
    compiler === 'swc'
  );
  configureTsProjectConfig(tree, schema);
  configureTsSolutionConfig(tree, schema);
  updateLintConfig(tree, schema);

  if (schema.uiFramework === '@storybook/angular') {
    addAngularStorybookTask(tree, schema.name);
  } else {
    addStorybookTask(tree, schema.name, schema.uiFramework);
  }

  if (schema.configureCypress) {
    if (projectType !== 'application') {
      const cypressTask = await cypressProjectGenerator(tree, {
        name: schema.name,
        js: schema.js,
        linter: schema.linter,
        directory: schema.cypressDirectory,
        standaloneConfig: schema.standaloneConfig,
      });
      tasks.push(cypressTask);
    } else {
      logger.warn('There is already an e2e project setup');
    }
  }

  if (nextBuildTarget && projectType === 'application') {
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        {
          ['storybook-addon-next']: storybookNextAddonVersion,
          ['storybook-addon-swc']: storybookSwcAddonVersion,
        }
      )
    );
  } else if (compiler === 'swc') {
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        {
          ['storybook-addon-swc']: storybookSwcAddonVersion,
        }
      )
    );
  }

  await formatFiles(tree);

  return runTasksInSerial(...tasks);
}

function normalizeSchema(
  schema: StorybookConfigureSchema
): StorybookConfigureSchema {
  const defaults = {
    configureCypress: true,
    linter: Linter.TsLint,
    js: false,
  };
  return {
    ...defaults,
    ...schema,
  };
}

export default configurationGenerator;
export const configurationSchematic = convertNxGenerator(
  configurationGenerator
);
