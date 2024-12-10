import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  logger,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';

import { StorybookConfigureSchema } from './schema';
import { initGenerator } from '../init/init';

import {
  addAngularStorybookTarget,
  addBuildStorybookToCacheableOperations,
  addStaticTarget,
  addStorybookTarget,
  addStorybookToNamedInputs,
  addStorybookToTargetDefaults,
  configureTsProjectConfig,
  configureTsSolutionConfig,
  createProjectStorybookDir,
  createStorybookTsconfigFile,
  editTsconfigBaseJson,
  findNextConfig,
  findViteConfig,
  isUsingReactNative,
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
  storybookVersion,
  tsLibVersion,
  tsNodeVersion,
} from '../../utils/versions';
import { interactionTestsDependencies } from './lib/interaction-testing.utils';
import { ensureDependencies } from './lib/ensure-dependencies';
import { editRootTsConfig } from './lib/edit-root-tsconfig';

export function configurationGenerator(
  tree: Tree,
  schema: StorybookConfigureSchema
) {
  return configurationGeneratorInternal(tree, { addPlugin: false, ...schema });
}

export async function configurationGeneratorInternal(
  tree: Tree,
  rawSchema: StorybookConfigureSchema
) {
  const storybookMajor = storybookMajorVersion();
  if (storybookMajor > 0 && storybookMajor === 6) {
    throw new Error(pleaseUpgrade());
  } else if (storybookMajor === 7) {
    logger.warn(
      `Support for Storybook 7 is deprecated. Please upgrade to Storybook 8. See https://nx.dev/nx-api/storybook/generators/migrate-8 for more details.`
    );
  }

  const schema = normalizeSchema(tree, rawSchema);

  const tasks: GeneratorCallback[] = [];

  const { projectType, targets, root } = readProjectConfiguration(
    tree,
    schema.project
  );
  const { compiler } = findStorybookAndBuildTargetsAndCompiler(targets);

  const viteConfig = findViteConfig(tree, root);
  const viteConfigFilePath = viteConfig?.fullConfigPath;
  const viteConfigFileName = viteConfig?.viteConfigFileName;
  const nextConfigFilePath = findNextConfig(tree, root);

  if (viteConfigFilePath) {
    if (schema.uiFramework === '@storybook/react-webpack5') {
      logger.info(
        `Your project ${schema.project} uses Vite as a bundler.
        Nx will configure Storybook for this project to use Vite as well.`
      );
      schema.uiFramework = '@storybook/react-vite';
    }
    if (schema.uiFramework === '@storybook/web-components-webpack5') {
      logger.info(
        `Your project ${schema.project} uses Vite as a bundler.
        Nx will configure Storybook for this project to use Vite as well.`
      );
      schema.uiFramework = '@storybook/web-components-vite';
    }
  }

  if (nextConfigFilePath) {
    schema.uiFramework = '@storybook/nextjs';
  }

  const jsInitTask = await jsInitGenerator(tree, {
    ...schema,
    skipFormat: true,
  });
  tasks.push(jsInitTask);
  const initTask = await initGenerator(tree, {
    skipFormat: true,
    addPlugin: schema.addPlugin,
  });
  tasks.push(initTask);
  tasks.push(ensureDependencies(tree, { uiFramework: schema.uiFramework }));

  editRootTsConfig(tree);

  const nxJson = readNxJson(tree);
  const hasPlugin = nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/storybook/plugin'
      : p.plugin === '@nx/storybook/plugin'
  );

  const mainDir =
    !!nextConfigFilePath && projectType === 'application'
      ? 'components'
      : 'src';

  const usesVite =
    !!viteConfigFilePath || schema.uiFramework?.endsWith('-vite');
  const usesReactNative = isUsingReactNative(schema.project);

  createProjectStorybookDir(
    tree,
    schema.project,
    schema.uiFramework,
    schema.js,
    schema.tsConfiguration,
    root,
    projectType,
    projectIsRootProjectInStandaloneWorkspace(root),
    schema.interactionTests,
    mainDir,
    !!nextConfigFilePath,
    compiler === 'swc',
    usesVite,
    viteConfigFilePath,
    hasPlugin,
    viteConfigFileName,
    usesReactNative
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
  if (!hasPlugin) {
    addStorybookToTargetDefaults(tree);
  }

  let devDeps = {};

  if (!hasPlugin || schema.addExplicitTargets) {
    if (schema.uiFramework === '@storybook/angular') {
      addAngularStorybookTarget(tree, schema.project, schema.interactionTests);
    } else {
      addStorybookTarget(
        tree,
        schema.project,
        schema.uiFramework,
        schema.interactionTests
      );
    }
    if (schema.configureStaticServe) {
      await addStaticTarget(tree, schema);
    }
  } else {
    devDeps['storybook'] = storybookVersion;
  }

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

  if (schema.uiFramework?.endsWith('-vite') && !viteConfigFilePath) {
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
  tree: Tree,
  schema: StorybookConfigureSchema
): StorybookConfigureSchema {
  const nxJson = readNxJson(tree);
  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  const defaults = {
    interactionTests: true,
    linter: Linter.EsLint,
    js: false,
    tsConfiguration: true,
    addPlugin,
  };
  return {
    ...defaults,
    ...schema,
  };
}

export default configurationGenerator;
