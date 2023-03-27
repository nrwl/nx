import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  logger,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
} from '@nrwl/devkit';

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
import { Linter } from '@nrwl/linter';
import {
  findStorybookAndBuildTargetsAndCompiler,
  isStorybookV7,
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

export async function configurationGenerator(
  tree: Tree,
  rawSchema: StorybookConfigureSchema
) {
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

  /**
   * Make sure someone is not trying to configure Storybook
   * with the wrong version.
   */
  let storybook7;
  try {
    storybook7 = isStorybookV7();
  } catch (e) {
    storybook7 = schema.storybook7Configuration;
  }

  if (storybook7 && !schema.storybook7Configuration) {
    schema.storybook7Configuration = true;
    logger.info(
      `You are using Storybook version 7. 
       So Nx will configure Storybook for version 7.`
    );
  }

  let viteConfigFilePath: string | undefined;

  if (viteBuildTarget) {
    if (schema.bundler !== 'vite') {
      if (!schema.storybook7Configuration) {
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

  if (schema.storybook7Configuration) {
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

  // If we're on Storybook 7, ignore schema.uiFramework
  const uiFrameworkUsed = schema.storybook7Configuration
    ? schema.storybook7UiFramework
    : schema.uiFramework;

  const initTask = await initGenerator(tree, {
    uiFramework: uiFrameworkUsed,
    js: schema.js,
    bundler: schema.bundler,
    storybook7Configuration: schema.storybook7Configuration,
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
    schema.storybook7Configuration,
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
      schema.storybook7Configuration
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
  if (
    nextBuildTarget &&
    projectType === 'application' &&
    !schema.storybook7Configuration
  ) {
    devDeps['storybook-addon-next'] = storybookNextAddonVersion;
    devDeps['storybook-addon-swc'] = storybookSwcAddonVersion;
  } else if (compiler === 'swc') {
    devDeps['storybook-addon-swc'] = storybookSwcAddonVersion;
  }

  if (schema.configureTestRunner === true) {
    devDeps['@storybook/test-runner'] = storybookTestRunnerVersion;
  }
  if (schema.configureStaticServe) {
    devDeps['@nrwl/web'] = nxVersion;
  }

  tasks.push(addDependenciesToPackageJson(tree, {}, devDeps));

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
