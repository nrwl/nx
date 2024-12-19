import {
  addProjectConfiguration,
  ensurePackage,
  GeneratorCallback,
  getPackageManagerCommand,
  joinPathFragments,
  readNxJson,
  Tree,
  writeJson,
} from '@nx/devkit';
import { webStaticServeGenerator } from '@nx/web';

import { nxVersion } from '../../../utils/versions';
import { hasWebpackPlugin } from '../../../utils/has-webpack-plugin';
import { hasVitePlugin } from '../../../utils/has-vite-plugin';
import { hasRspackPlugin } from '../../../utils/has-rspack-plugin';
import { hasRsbuildPlugin } from '../../../utils/has-rsbuild-plugin';
import { NormalizedSchema } from '../schema';
import { findPluginForConfigFile } from '@nx/devkit/src/utils/find-plugin-for-config-file';
import { addE2eCiTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import { E2EWebServerDetails } from '@nx/devkit/src/generators/e2e-web-server-info-utils';

export async function addE2e(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const hasNxBuildPlugin =
    (options.bundler === 'webpack' && hasWebpackPlugin(tree)) ||
    (options.bundler === 'rspack' && hasRspackPlugin(tree)) ||
    (options.bundler === 'rsbuild' &&
      (await hasRsbuildPlugin(tree, options.appProjectRoot))) ||
    (options.bundler === 'vite' && hasVitePlugin(tree));

  let e2eWebServerInfo: E2EWebServerDetails = {
    e2eWebServerAddress: `http://localhost:${options.devServerPort ?? 4200}`,
    e2eWebServerCommand: `${getPackageManagerCommand().exec} nx run ${
      options.projectName
    }:serve`,
    e2eCiWebServerCommand: `${getPackageManagerCommand().exec} nx run ${
      options.projectName
    }:serve-static`,
    e2eCiBaseUrl: `http://localhost:4200`,
    e2eDevServerTarget: `${options.projectName}:serve`,
  };

  if (options.bundler === 'webpack') {
    const { getWebpackE2EWebServerInfo } = ensurePackage<
      typeof import('@nx/webpack')
    >('@nx/webpack', nxVersion);
    e2eWebServerInfo = await getWebpackE2EWebServerInfo(
      tree,
      options.projectName,
      joinPathFragments(
        options.appProjectRoot,
        `webpack.config.${options.js ? 'js' : 'ts'}`
      ),
      options.addPlugin,
      options.devServerPort ?? 4200
    );
  } else if (options.bundler === 'vite') {
    const { getViteE2EWebServerInfo } = ensurePackage<
      typeof import('@nx/vite')
    >('@nx/vite', nxVersion);
    e2eWebServerInfo = await getViteE2EWebServerInfo(
      tree,
      options.projectName,
      joinPathFragments(
        options.appProjectRoot,
        `vite.config.${options.js ? 'js' : 'ts'}`
      ),
      options.addPlugin,
      options.devServerPort ?? 4200
    );
  } else if (options.bundler === 'rsbuild') {
    ensurePackage('@nx/rsbuild', nxVersion);
    const { getRsbuildE2EWebServerInfo } = await import(
      '@nx/rsbuild/config-utils'
    );

    e2eWebServerInfo = await getRsbuildE2EWebServerInfo(
      tree,
      options.projectName,
      joinPathFragments(
        options.appProjectRoot,
        `rsbuild.config.${options.js ? 'js' : 'ts'}`
      ),
      options.addPlugin,
      options.devServerPort ?? 4200
    );
  }

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

      if (options.isUsingTsSolutionConfig) {
        writeJson(
          tree,
          joinPathFragments(options.e2eProjectRoot, 'package.json'),
          {
            name: options.e2eProjectName,
            version: '0.0.1',
            private: true,
            nx: {
              projectType: 'application',
              sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
              implicitDependencies: [options.projectName],
            },
          }
        );
      } else {
        addProjectConfiguration(tree, options.e2eProjectName, {
          projectType: 'application',
          root: options.e2eProjectRoot,
          sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
          targets: {},
          implicitDependencies: [options.projectName],
          tags: [],
        });
      }

      const e2eTask = await configurationGenerator(tree, {
        ...options,
        project: options.e2eProjectName,
        directory: 'src',
        // the name and root are already normalized, instruct the generator to use them as is
        bundler:
          options.bundler === 'rspack'
            ? 'webpack'
            : options.bundler === 'rsbuild'
            ? 'none'
            : options.bundler,
        skipFormat: true,
        devServerTarget: e2eWebServerInfo.e2eDevServerTarget,
        baseUrl: e2eWebServerInfo.e2eWebServerAddress,
        jsx: true,
        rootProject: options.rootProject,
        webServerCommands: hasNxBuildPlugin
          ? {
              default: e2eWebServerInfo.e2eWebServerCommand,
              production: e2eWebServerInfo.e2eCiWebServerCommand,
            }
          : undefined,
        ciWebServerCommand: hasNxBuildPlugin
          ? e2eWebServerInfo.e2eCiWebServerCommand
          : undefined,
        ciBaseUrl: e2eWebServerInfo.e2eCiBaseUrl,
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
      if (options.isUsingTsSolutionConfig) {
        writeJson(
          tree,
          joinPathFragments(options.e2eProjectRoot, 'package.json'),
          {
            name: options.e2eProjectName,
            version: '0.0.1',
            private: true,
            nx: {
              projectType: 'application',
              sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
              implicitDependencies: [options.projectName],
            },
          }
        );
      } else {
        addProjectConfiguration(tree, options.e2eProjectName, {
          projectType: 'application',
          root: options.e2eProjectRoot,
          sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
          targets: {},
          implicitDependencies: [options.projectName],
        });
      }

      const e2eTask = await configurationGenerator(tree, {
        project: options.e2eProjectName,
        skipFormat: true,
        skipPackageJson: options.skipPackageJson,
        directory: 'src',
        js: false,
        linter: options.linter,
        setParserOptionsProject: options.setParserOptionsProject,
        webServerCommand: e2eWebServerInfo.e2eCiWebServerCommand,
        webServerAddress: e2eWebServerInfo.e2eCiBaseUrl,
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
