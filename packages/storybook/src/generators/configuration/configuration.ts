import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  logger,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';

import { cypressProjectGenerator } from '../cypress-project/cypress-project';
import { StorybookConfigureSchema } from './schema';
import { initGenerator } from '../init/init';

import {
  addAngularStorybookTask,
  addBuildStorybookToCacheableOperations,
  addStaticTarget,
  addStorybookTask,
  addStorybookToNamedInputs,
  configureTsProjectConfig,
  configureTsSolutionConfig,
  createProjectStorybookDir,
  getE2EProjectName,
  getViteConfigFilePath,
  projectIsRootProjectInStandaloneWorkspace,
  updateLintConfig,
} from './lib/util-functions';
import { Linter } from '@nx/linter';
import {
  findStorybookAndBuildTargetsAndCompiler,
  storybookMajorVersion,
} from '../../utils/utilities';
import {
  nxVersion,
  storybookNextAddonVersion,
  storybookSwcAddonVersion,
  storybookTestRunnerVersion,
  storybookVersion,
  tsNodeVersion,
} from '../../utils/versions';
import { getGeneratorConfigurationOptions } from './lib/user-prompts';
import { pleaseUpgrade } from '../../executors/utils';

export async function configurationGenerator(
  tree: Tree,
  rawSchema: StorybookConfigureSchema
) {
  /**
   * Make sure someone is not trying to configure Storybook
   * with the wrong version.
   */

  let storybook7 =
    storybookMajorVersion() === 7 || rawSchema.storybook7Configuration;

  if (storybookMajorVersion() === 6 && rawSchema.storybook7Configuration) {
    logger.error(
      `You are using Storybook version 6. 
         So Nx will configure Storybook for version 6.`
    );
    pleaseUpgrade();
    rawSchema.storybook7Configuration = false;
    storybook7 = false;
  }

  if (storybook7 && !rawSchema.storybook7Configuration) {
    rawSchema.storybook7Configuration = true;
    logger.info(
      `You are using Storybook version 7. 
       So Nx will configure Storybook for version 7.`
    );
  }

  if (process.env.NX_INTERACTIVE === 'true') {
    rawSchema = await getGeneratorConfigurationOptions(rawSchema);
  }

  const schema = normalizeSchema(rawSchema);

  const tasks: GeneratorCallback[] = [];

  const { projectType, targets, root } = readProjectConfiguration(
    tree,
    schema.name
  );
  const { nextBuildTarget, compiler, viteBuildTarget } =
    findStorybookAndBuildTargetsAndCompiler(targets);

  let viteConfigFilePath: string | undefined;

  if (viteBuildTarget) {
    if (schema.bundler !== 'vite') {
      if (!storybook7) {
        // The warnings for v7 are handled in the next if statement
        logger.info(
          `Your project ${schema.name} uses Vite as a bundler. 
          Nx will configure Storybook for this project to use Vite as well.`
        );
      }
      // We need this regardless of Storybook version
      // because we use it in the init task
      schema.bundler = 'vite';
    }

    viteConfigFilePath = getViteConfigFilePath(
      tree,
      root,
      targets[viteBuildTarget]?.options?.configFile
    );
  }

  if (storybook7) {
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
  } else {
    if (!schema.uiFramework) {
      if (schema.storybook7UiFramework?.startsWith('@storybook/react')) {
        schema.uiFramework = '@storybook/react';
      } else if (
        schema.storybook7UiFramework?.startsWith('@storybook/web-components')
      ) {
        schema.uiFramework = '@storybook/web-components';
      } else if (schema.storybook7UiFramework === '@storybook/angular') {
        schema.uiFramework = '@storybook/angular';
      } else if (
        schema.storybook7UiFramework?.startsWith('@storybook/react-native')
      ) {
        schema.uiFramework = '@storybook/react-native';
      } else {
        logger.error(
          `You have to specify a uiFramework for Storybook version 6.`
        );
      }
    }
  }

  // If we're on Storybook 7, ignore schema.uiFramework
  const uiFrameworkUsed = storybook7
    ? schema.storybook7UiFramework
    : schema.uiFramework;

  const initTask = await initGenerator(tree, {
    uiFramework: uiFrameworkUsed,
    js: schema.js,
    bundler: schema.bundler,
    storybook7Configuration: storybook7,
  });
  tasks.push(initTask);

  createProjectStorybookDir(
    tree,
    schema.name,
    uiFrameworkUsed,
    schema.js,
    schema.tsConfiguration,
    root,
    projectType,
    projectIsRootProjectInStandaloneWorkspace(root),
    !!nextBuildTarget,
    compiler === 'swc',
    schema.bundler === 'vite',
    storybook7,
    viteConfigFilePath
  );

  configureTsProjectConfig(tree, schema);
  configureTsSolutionConfig(tree, schema);
  updateLintConfig(tree, schema);

  addBuildStorybookToCacheableOperations(tree);
  addStorybookToNamedInputs(tree);

  if (uiFrameworkUsed === '@storybook/angular') {
    addAngularStorybookTask(tree, schema.name, schema.configureTestRunner);
  } else {
    addStorybookTask(
      tree,
      schema.name,
      uiFrameworkUsed,
      schema.configureTestRunner,
      storybook7
    );
  }

  if (schema.configureStaticServe) {
    addStaticTarget(tree, schema);
  }

  if (schema.configureCypress) {
    const e2eProject = await getE2EProjectName(tree, schema.name);
    if (!e2eProject) {
      const cypressTask = await cypressProjectGenerator(tree, {
        name: schema.name,
        js: schema.js,
        linter: schema.linter,
        directory: schema.cypressDirectory,
        standaloneConfig: schema.standaloneConfig,
        ciTargetName: schema.configureStaticServe
          ? 'static-storybook'
          : undefined,
        skipFormat: true,
      });
      tasks.push(cypressTask);
    } else {
      logger.warn(
        `There is already an e2e project setup for ${schema.name}, called ${e2eProject}.`
      );
    }
  }

  const devDeps = {};

  if (schema.tsConfiguration) {
    devDeps['@storybook/core-common'] = storybookVersion;
    devDeps['ts-node'] = tsNodeVersion;
  }
  if (nextBuildTarget && projectType === 'application' && !storybook7) {
    devDeps['storybook-addon-next'] = storybookNextAddonVersion;
    devDeps['storybook-addon-swc'] = storybookSwcAddonVersion;
  } else if (compiler === 'swc' && !storybook7) {
    devDeps['storybook-addon-swc'] = storybookSwcAddonVersion;
  }

  if (schema.configureTestRunner === true) {
    devDeps['@storybook/test-runner'] = storybookTestRunnerVersion;
  }
  if (schema.configureStaticServe) {
    devDeps['@nx/web'] = nxVersion;
  }

  tasks.push(addDependenciesToPackageJson(tree, {}, devDeps));

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

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
