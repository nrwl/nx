import {
  type Tree,
  addProjectConfiguration,
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
  ensurePackage,
  getPackageManagerCommand,
  readNxJson,
} from '@nx/devkit';
import { type NormalizedSchema } from './normalize-options';
import { getPackageVersion } from '../../../utils/versions';
import { findPluginForConfigFile } from '@nx/devkit/src/utils/find-plugin-for-config-file';
import { addE2eCiTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';

export async function addE2E(tree: Tree, options: NormalizedSchema) {
  const hasRemixPlugin = readNxJson(tree).plugins?.find((p) =>
    typeof p === 'string'
      ? p === '@nx/remix/plugin'
      : p.plugin === '@nx/remix/plugin'
  );
  if (options.e2eTestRunner === 'cypress') {
    const { configurationGenerator } = ensurePackage<
      typeof import('@nx/cypress')
    >('@nx/cypress', getPackageVersion(tree, 'nx'));

    addProjectConfiguration(tree, options.e2eProjectName, {
      projectType: 'application',
      root: options.e2eProjectRoot,
      sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
      targets: {},
      tags: [],
      implicitDependencies: [options.projectName],
    });

    const e2eTask = await configurationGenerator(tree, {
      project: options.e2eProjectName,
      directory: 'src',
      skipFormat: true,
      devServerTarget: `${options.projectName}:${options.e2eWebServerTarget}:development`,
      baseUrl: options.e2eWebServerAddress,
      addPlugin: options.addPlugin,
    });

    if (
      options.addPlugin ||
      readNxJson(tree).plugins?.find((p) =>
        typeof p === 'string'
          ? p === '@nx/cypress/plugin'
          : p.plugin === '@nx/cypress/plugin'
      )
    ) {
      let buildTarget = '^build';
      if (hasRemixPlugin) {
        const matchingPlugin = await findPluginForConfigFile(
          tree,
          `@nx/remix/plugin`,
          joinPathFragments(options.projectRoot, 'remix.config.js')
        );
        if (matchingPlugin && typeof matchingPlugin !== 'string') {
          buildTarget = `^${
            (matchingPlugin.options as any)?.buildTargetName ?? 'build'
          }`;
        }
      }
      await addE2eCiTargetDefaults(
        tree,
        '@nx/cypress/plugin',
        buildTarget,
        joinPathFragments(
          options.e2eProjectRoot,
          `cypress.config.${options.js ? 'js' : 'ts'}`
        )
      );
    }

    return e2eTask;
  } else if (options.e2eTestRunner === 'playwright') {
    const { configurationGenerator } = ensurePackage<
      typeof import('@nx/playwright')
    >('@nx/playwright', getPackageVersion(tree, 'nx'));

    addProjectConfiguration(tree, options.e2eProjectName, {
      projectType: 'application',
      root: options.e2eProjectRoot,
      sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
      targets: {},
      tags: [],
      implicitDependencies: [options.projectName],
    });

    const e2eTask = await configurationGenerator(tree, {
      project: options.e2eProjectName,
      skipFormat: true,
      skipPackageJson: false,
      directory: 'src',
      js: false,
      linter: options.linter,
      setParserOptionsProject: false,
      webServerCommand: `${getPackageManagerCommand().exec} nx ${
        options.e2eWebServerTarget
      } ${options.name}`,
      webServerAddress: options.e2eWebServerAddress,
      rootProject: options.rootProject,
      addPlugin: options.addPlugin,
    });

    if (
      options.addPlugin ||
      readNxJson(tree).plugins?.find((p) =>
        typeof p === 'string'
          ? p === '@nx/playwright/plugin'
          : p.plugin === '@nx/playwright/plugin'
      )
    ) {
      let buildTarget = '^build';
      if (hasRemixPlugin) {
        const matchingPlugin = await findPluginForConfigFile(
          tree,
          `@nx/remix/plugin`,
          joinPathFragments(options.projectRoot, 'remix.config.js')
        );
        if (matchingPlugin && typeof matchingPlugin !== 'string') {
          buildTarget = `^${
            (matchingPlugin.options as any)?.buildTargetName ?? 'build'
          }`;
        }
      }
      await addE2eCiTargetDefaults(
        tree,
        '@nx/playwright/plugin',
        buildTarget,
        joinPathFragments(options.e2eProjectRoot, `playwright.config.ts`)
      );
    }

    return e2eTask;
  } else {
    return () => {};
  }
}
