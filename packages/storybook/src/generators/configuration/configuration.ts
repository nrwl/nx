import {
  addDependenciesToPackageJson,
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
  createStorybookTsconfigFile,
  editTsconfigBaseJson,
  getE2EProjectName,
  getViteConfigFilePath,
  projectIsRootProjectInStandaloneWorkspace,
  updateLintConfig,
} from './lib/util-functions';
import { Linter } from '@nx/eslint';
import {
  findStorybookAndBuildTargetsAndCompiler,
  pleaseUpgrade,
  storybookMajorVersion,
} from '../../utils/utilities';
import {
  coreJsVersion,
  nxVersion,
  tsLibVersion,
  tsNodeVersion,
} from '../../utils/versions';
import { interactionTestsDependencies } from './lib/interaction-testing.utils';

export async function configurationGenerator(
  tree: Tree,
  rawSchema: StorybookConfigureSchema
) {
  if (storybookMajorVersion() === 6) {
    throw new Error(pleaseUpgrade());
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
    viteConfigFilePath = getViteConfigFilePath(
      tree,
      root,
      targets[viteBuildTarget]?.options?.configFile
    );
  }

  if (viteBuildTarget) {
    if (schema.uiFramework === '@storybook/react-webpack5') {
      logger.info(
        `Your project ${schema.name} uses Vite as a bundler.
        Nx will configure Storybook for this project to use Vite as well.`
      );
      schema.uiFramework = '@storybook/react-vite';
    }
    if (schema.uiFramework === '@storybook/web-components-webpack5') {
      logger.info(
        `Your project ${schema.name} uses Vite as a bundler.
        Nx will configure Storybook for this project to use Vite as well.`
      );
      schema.uiFramework = '@storybook/web-components-vite';
    }
  }

  if (nextBuildTarget) {
    schema.uiFramework = '@storybook/nextjs';
  }

  const initTask = await initGenerator(tree, {
    uiFramework: schema.uiFramework,
    js: schema.js,
  });
  tasks.push(initTask);

  const mainDir =
    !!nextBuildTarget && projectType === 'application' ? 'components' : 'src';

  const usesVite = !!viteBuildTarget || schema.uiFramework.endsWith('-vite');

  createProjectStorybookDir(
    tree,
    schema.name,
    schema.uiFramework,
    schema.js,
    schema.tsConfiguration,
    root,
    projectType,
    projectIsRootProjectInStandaloneWorkspace(root),
    schema.interactionTests,
    mainDir,
    !!nextBuildTarget,
    compiler === 'swc',
    usesVite,
    viteConfigFilePath
  );

  if (schema.uiFramework !== '@storybook/angular') {
    createStorybookTsconfigFile(
      tree,
      root,
      schema.uiFramework,
      projectIsRootProjectInStandaloneWorkspace(root),
      mainDir
    );
  }
  configureTsProjectConfig(tree, schema);
  editTsconfigBaseJson(tree);
  configureTsSolutionConfig(tree, schema);
  updateLintConfig(tree, schema);

  addBuildStorybookToCacheableOperations(tree);
  addStorybookToNamedInputs(tree);

  if (schema.uiFramework === '@storybook/angular') {
    addAngularStorybookTask(tree, schema.name, schema.interactionTests);
  } else {
    addStorybookTask(
      tree,
      schema.name,
      schema.uiFramework,
      schema.interactionTests
    );
  }

  if (schema.configureStaticServe) {
    addStaticTarget(tree, schema);
  }

  // TODO(katerina): Nx 18 -> remove Cypress
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

  let devDeps = {};

  if (schema.tsConfiguration) {
    devDeps['ts-node'] = tsNodeVersion;
  }

  if (usesVite && !viteConfigFilePath) {
    devDeps['tslib'] = tsLibVersion;
  }

  if (schema.interactionTests) {
    devDeps = {
      ...devDeps,
      ...interactionTestsDependencies(),
    };
  }

  if (schema.configureStaticServe) {
    devDeps['@nx/web'] = nxVersion;
  }

  if (
    projectType !== 'application' &&
    schema.uiFramework === '@storybook/react-webpack5'
  ) {
    devDeps['core-js'] = coreJsVersion;
  }

  if (
    schema.uiFramework.endsWith('-vite') &&
    (!viteBuildTarget || !viteConfigFilePath)
  ) {
    // This means that the user has selected a Vite framework
    // but the project does not have Vite configuration.
    // We need to install the @nx/vite plugin in order to be able to use
    // the nxViteTsPaths plugin to register the tsconfig paths in Vite.
    devDeps['@nx/vite'] = nxVersion;
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
    interactionTests: true,
    linter: Linter.EsLint,
    js: false,
    tsConfiguration: true,
  };
  return {
    ...defaults,
    ...schema,
  };
}

export default configurationGenerator;
