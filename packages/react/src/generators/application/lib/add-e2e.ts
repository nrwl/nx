import type { GeneratorCallback, Tree } from '@nx/devkit';
import {
  addProjectConfiguration,
  ensurePackage,
  getPackageManagerCommand,
  joinPathFragments,
  readNxJson,
} from '@nx/devkit';
import { webStaticServeGenerator } from '@nx/web';

import { nxVersion } from '../../../utils/versions';
import { hasWebpackPlugin } from '../../../utils/has-webpack-plugin';
import { hasVitePlugin } from '../../../utils/has-vite-plugin';
import { NormalizedSchema } from '../schema';
import { findPluginForConfigFile } from '@nx/devkit/src/utils/find-plugin-for-config-file';
import { addE2eCiTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';

export async function addE2e(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const hasNxBuildPlugin =
    (options.bundler === 'webpack' && hasWebpackPlugin(tree)) ||
    (options.bundler === 'vite' && hasVitePlugin(tree));
  if (!hasNxBuildPlugin) {
    await webStaticServeGenerator(tree, {
      buildTarget: `${options.projectName}:build`,
      targetName: 'serve-static',
      spa: true,
    });
  }
  switch (options.e2eTestRunner) {
    case 'cypress': {
      const { configurationGenerator } = ensurePackage<
        typeof import('@nx/cypress')
      >('@nx/cypress', nxVersion);

      addProjectConfiguration(tree, options.e2eProjectName, {
        projectType: 'application',
        root: options.e2eProjectRoot,
        sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
        targets: {},
        implicitDependencies: [options.projectName],
        tags: [],
      });

      const e2eTask = await configurationGenerator(tree, {
        ...options,
        project: options.e2eProjectName,
        directory: 'src',
        // the name and root are already normalized, instruct the generator to use them as is
        bundler: options.bundler === 'rspack' ? 'webpack' : options.bundler,
        skipFormat: true,
        devServerTarget: `${options.projectName}:${options.e2eWebServerTarget}`,
        baseUrl: options.e2eWebServerAddress,
        jsx: true,
        rootProject: options.rootProject,
        webServerCommands: hasNxBuildPlugin
          ? {
              default: `nx run ${options.projectName}:${options.e2eWebServerTarget}`,
              production: `nx run ${options.projectName}:preview`,
            }
          : undefined,
        ciWebServerCommand: hasNxBuildPlugin
          ? `nx run ${options.projectName}:${options.e2eCiWebServerTarget}`
          : undefined,
        ciBaseUrl:
          options.bundler === 'vite' ? options.e2eCiBaseUrl : undefined,
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
        if (hasNxBuildPlugin) {
          const configFile =
            options.bundler === 'webpack'
              ? 'webpack.config.js'
              : options.bundler === 'vite'
              ? `vite.config.${options.js ? 'js' : 'ts'}`
              : 'webpack.config.js';
          const matchingPlugin = await findPluginForConfigFile(
            tree,
            `@nx/${options.bundler}/plugin`,
            joinPathFragments(options.appProjectRoot, configFile)
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
    }
    case 'playwright': {
      const { configurationGenerator } = ensurePackage<
        typeof import('@nx/playwright')
      >('@nx/playwright', nxVersion);
      addProjectConfiguration(tree, options.e2eProjectName, {
        projectType: 'application',
        root: options.e2eProjectRoot,
        sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
        targets: {},
        implicitDependencies: [options.projectName],
      });
      const e2eTask = await configurationGenerator(tree, {
        project: options.e2eProjectName,
        skipFormat: true,
        skipPackageJson: options.skipPackageJson,
        directory: 'src',
        js: false,
        linter: options.linter,
        setParserOptionsProject: options.setParserOptionsProject,
        webServerCommand: `${getPackageManagerCommand().exec} nx run ${
          options.projectName
        }:${options.e2eCiWebServerTarget}`,
        webServerAddress: options.e2eCiBaseUrl,
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
        if (hasNxBuildPlugin) {
          const configFile =
            options.bundler === 'webpack'
              ? 'webpack.config.js'
              : options.bundler === 'vite'
              ? `vite.config.${options.js ? 'js' : 'ts'}`
              : 'webpack.config.js';
          const matchingPlugin = await findPluginForConfigFile(
            tree,
            `@nx/${options.bundler}/plugin`,
            joinPathFragments(options.appProjectRoot, configFile)
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
    }
    case 'none':
    default:
      return () => {};
  }
}
