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
  addBuildStorybookToCacheableOperations,
  addStorybookTask,
  configureTsProjectConfig,
  configureTsSolutionConfig,
  createProjectStorybookDir,
  createRootStorybookDir,
  createRootStorybookDirForRootProject,
  getE2EProjectName,
  projectIsRootProjectInNestedWorkspace,
  updateLintConfig,
} from './util-functions';
import { Linter } from '@nrwl/linter';
import {
  findStorybookAndBuildTargetsAndCompiler,
  isStorybookV7,
} from '../../utils/utilities';
import {
  storybookNextAddonVersion,
  storybookSwcAddonVersion,
  storybookTestRunnerVersion,
  storybookVersion,
} from '../../utils/versions';

export async function configurationGenerator(
  tree: Tree,
  rawSchema: StorybookConfigureSchema
) {
  const schema = normalizeSchema(rawSchema);

  const tasks: GeneratorCallback[] = [];

  const { projectType, targets, root } = readProjectConfiguration(
    tree,
    schema.name
  );
  const { nextBuildTarget, compiler, viteBuildTarget } =
    findStorybookAndBuildTargetsAndCompiler(targets);

  /**
   * Make sure someone is not trying to configure Storybook
   * with the wrong version.
   */
  let storybook7;
  try {
    storybook7 = isStorybookV7();
  } catch (e) {
    storybook7 = schema.storybook7betaConfiguration;
  }

  if (storybook7 && !schema.storybook7betaConfiguration) {
    schema.storybook7betaConfiguration = true;
    logger.info(
      `You are using Storybook version 7. 
       So Nx will configure Storybook for version 7.`
    );
  }

  if (viteBuildTarget) {
    if (schema.bundler !== 'vite') {
      logger.info(
        `Your project ${schema.name} uses Vite as a bundler. 
        Nx will configure Storybook for this project to use Vite as well.`
      );
      schema.bundler = 'vite';
    }
  }

  if (schema.storybook7betaConfiguration) {
    if (viteBuildTarget) {
      if (schema.storybook7UiFramework === '@storybook/react-webpack5') {
        logger.info(
          `Your project ${schema.name} uses Vite as a bundler. 
        Nx will configure Storybook for this project to use Vite as well.`
        );
        schema.storybook7UiFramework = '@storybook/react-vite';
      }
      if (
        schema.storybook7UiFramework === '@storybook/web-components-webpack5'
      ) {
        logger.info(
          `Your project ${schema.name} uses Vite as a bundler. 
        Nx will configure Storybook for this project to use Vite as well.`
        );
        schema.storybook7UiFramework = '@storybook/web-components-vite';
      }
    }

    if (nextBuildTarget) {
      schema.storybook7UiFramework = '@storybook/nextjs';
    }

    if (!schema.storybook7UiFramework) {
      if (schema.uiFramework === '@storybook/react') {
        schema.storybook7UiFramework = viteBuildTarget
          ? '@storybook/react-vite'
          : '@storybook/react-webpack5';
      } else if (schema.uiFramework === '@storybook/web-components') {
        schema.storybook7UiFramework = viteBuildTarget
          ? '@storybook/web-components-vite'
          : '@storybook/web-components-webpack5';
      } else if (schema.uiFramework === '@storybook/angular') {
        schema.storybook7UiFramework = '@storybook/angular';
      } else if (schema.uiFramework !== '@storybook/react-native') {
        schema.storybook7UiFramework = `${schema.uiFramework}-webpack5`;
      }
    }
  }

  const initTask = initGenerator(tree, {
    uiFramework: schema.storybook7betaConfiguration
      ? schema.storybook7UiFramework
      : schema.uiFramework,
    bundler: schema.bundler,
    storybook7betaConfiguration: schema.storybook7betaConfiguration,
  });
  tasks.push(initTask);

  if (projectIsRootProjectInNestedWorkspace(root)) {
    createRootStorybookDirForRootProject(
      tree,
      schema.name,
      schema.storybook7betaConfiguration
        ? schema.storybook7UiFramework
        : schema.uiFramework,
      schema.js,
      schema.tsConfiguration,
      root,
      projectType,
      !!nextBuildTarget,
      compiler === 'swc',
      schema.bundler === 'vite',
      schema.storybook7betaConfiguration
    );
  } else {
    createRootStorybookDir(tree, schema.js, schema.tsConfiguration);
    createProjectStorybookDir(
      tree,
      schema.name,
      schema.storybook7betaConfiguration
        ? schema.storybook7UiFramework
        : schema.uiFramework,
      schema.js,
      schema.tsConfiguration,
      !!nextBuildTarget,
      compiler === 'swc',
      schema.bundler === 'vite',
      schema.storybook7betaConfiguration
    );
  }

  configureTsProjectConfig(tree, schema);
  configureTsSolutionConfig(tree, schema);
  updateLintConfig(tree, schema);

  addBuildStorybookToCacheableOperations(tree);

  if (schema.uiFramework === '@storybook/angular') {
    addAngularStorybookTask(tree, schema.name, schema.configureTestRunner);
  } else {
    addStorybookTask(
      tree,
      schema.name,
      schema.uiFramework,
      schema.configureTestRunner,
      schema.storybook7betaConfiguration
    );
  }

  const e2eProject = await getE2EProjectName(tree, schema.name);
  if (schema.configureCypress && !e2eProject) {
    const cypressTask = await cypressProjectGenerator(tree, {
      name: schema.name,
      js: schema.js,
      linter: schema.linter,
      directory: schema.cypressDirectory,
      standaloneConfig: schema.standaloneConfig,
    });
    tasks.push(cypressTask);
  } else {
    logger.warn(
      `There is already an e2e project setup for ${schema.name}, called ${e2eProject}.`
    );
  }

  if (schema.tsConfiguration) {
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        {
          ['@storybook/core-common']: storybookVersion,
        }
      )
    );
  }

  if (
    nextBuildTarget &&
    projectType === 'application' &&
    !schema.storybook7betaConfiguration
  ) {
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

  if (schema.configureTestRunner === true) {
    tasks.push(
      addDependenciesToPackageJson(
        tree,
        {},
        {
          '@storybook/test-runner': storybookTestRunnerVersion,
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
    linter: Linter.EsLint,
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
