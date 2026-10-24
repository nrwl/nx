import {
  addDependenciesToPackageJson,
  detectPackageManager,
  formatFiles,
  GeneratorCallback,
  logger,
  readProjectConfiguration,
  runTasksInSerial,
  getDependencyVersionFromPackageJson,
  Tree,
} from '@nx/devkit';
import { acknowledgeBuildScripts } from '@nx/devkit/internal';
import { coerce, gte, major, minVersion } from 'semver';
import { initGenerator as jsInitGenerator } from '@nx/js';

import { StorybookConfigureSchema } from './schema';
import { initGenerator } from '../init/init';
import { assertSupportedStorybookVersion } from '../../utils/assert-supported-storybook-version';

import {
  addAngularStorybookTarget,
  addBuildStorybookToCacheableOperations,
  addStaticTarget,
  addStorybookToNamedInputs,
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
import {
  findStorybookAndBuildTargetsAndCompiler,
  getStorybookVersionToInstall,
  storybookMajorVersion,
} from '../../utils/utilities';
import {
  coreJsVersion,
  nxVersion,
  tsLibVersion,
  tsNodeVersion,
  versions,
  viteTsconfigPathsVersion,
} from '../../utils/versions';
import { ensureDependencies } from './lib/ensure-dependencies';
import { editRootTsConfig } from './lib/edit-root-tsconfig';
import { acknowledgeSwcBuildScripts, getProjectType } from '@nx/js/internal';

export function configurationGenerator(
  tree: Tree,
  schema: StorybookConfigureSchema
) {
  return configurationGeneratorInternal(tree, schema);
}

export async function configurationGeneratorInternal(
  tree: Tree,
  rawSchema: StorybookConfigureSchema
) {
  assertSupportedStorybookVersion(tree);

  const storybookMajor = storybookMajorVersion(tree);
  if (storybookMajor === 8) {
    logger.warn(
      `Support for Storybook 8 is deprecated. Please upgrade to Storybook 9. See https://nx.dev/nx-api/storybook/generators/migrate-9 for more details.`
    );
  }

  const schema = normalizeSchema(rawSchema);

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
  });
  tasks.push(initTask);
  tasks.push(ensureDependencies(tree, { uiFramework: schema.uiFramework }));

  editRootTsConfig(tree);

  const mainDir =
    !!nextConfigFilePath &&
    getProjectType(tree, root, projectType) === 'application'
      ? 'components'
      : 'src';

  const usesVite =
    !!viteConfigFilePath || schema.uiFramework?.endsWith('-vite');
  const usesReactNative = isUsingReactNative(schema.project);
  // resolve.tsconfigPaths is native only from Vite 8; older majors ignore it.
  const installedVite = coerce(
    getDependencyVersionFromPackageJson(tree, 'vite') ?? ''
  );
  const useNativeTsconfigPaths = !installedVite || major(installedVite) >= 8;

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
    viteConfigFileName,
    usesReactNative,
    useNativeTsconfigPaths
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
  addStorybookToNamedInputs(tree, schema);

  let devDeps = {};

  if (schema.uiFramework === '@storybook/angular') {
    // `@storybook/angular:*` builders are third-party and still supported, so
    // Angular keeps an explicit target rather than relying on inference.
    addAngularStorybookTarget(tree, schema.project, schema.interactionTests);
    if (schema.configureStaticServe) {
      await addStaticTarget(tree, schema);
    }
  } else {
    devDeps['storybook'] = getStorybookVersionToInstall(tree);
  }

  if (schema.interactionTests) {
    const testRunnerVersion = versions(tree).testRunnerVersion;
    // @storybook/test-runner depends on @swc/core.
    acknowledgeSwcBuildScripts(tree);
    if (gte(minVersion(testRunnerVersion), '0.24.0')) {
      // Only the 0.24 line runs on jest 30, whose jest-resolve depends on
      // unrs-resolver and, from 30.5.0, pins a jest-haste-map that depends on
      // @parcel/watcher. Storybook 8 and 9 select jest 29, which needs neither.
      acknowledgeBuildScripts(tree, detectPackageManager(tree.root), {
        '@parcel/watcher': false,
        'unrs-resolver': false,
      });
    }
    devDeps['@storybook/test-runner'] = testRunnerVersion;
  }

  if (schema.tsConfiguration) {
    devDeps['ts-node'] = tsNodeVersion;
  }

  if (usesVite && !viteConfigFilePath) {
    devDeps['tslib'] = tsLibVersion;
    if (!useNativeTsconfigPaths) {
      devDeps['vite-tsconfig-paths'] = viteTsconfigPathsVersion;
    }
  }

  if (schema.configureStaticServe) {
    devDeps['@nx/web'] = nxVersion;
  }

  if (
    projectType !== 'application' &&
    schema.uiFramework === '@storybook/react-webpack5'
  ) {
    // core-js' install script only prints a funding message.
    acknowledgeBuildScripts(tree, detectPackageManager(tree.root), {
      'core-js': false,
    });
    devDeps['core-js'] = coreJsVersion;
  }

  tasks.push(addDependenciesToPackageJson(tree, {}, devDeps, undefined, true));

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
    js: false,
    tsConfiguration: true,
  };
  return {
    ...defaults,
    ...schema,
  };
}

export default configurationGenerator;
