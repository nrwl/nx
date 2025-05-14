import {
  addProjectConfiguration,
  ensurePackage,
  GeneratorCallback,
  getPackageManagerCommand,
  joinPathFragments,
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
import { E2EWebServerDetails } from '@nx/devkit/src/generators/e2e-web-server-info-utils';
import type { PackageJson } from 'nx/src/utils/package-json';

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
  } else if (options.bundler === 'rspack') {
    const { getRspackE2EWebServerInfo } = ensurePackage<
      typeof import('@nx/rspack')
    >('@nx/rspack', nxVersion);
    e2eWebServerInfo = await getRspackE2EWebServerInfo(
      tree,
      options.projectName,
      joinPathFragments(
        options.appProjectRoot,
        `rspack.config.${options.js ? 'js' : 'ts'}`
      ),
      options.addPlugin,
      options.devServerPort ?? 4200
    );
  } else if (options.bundler === 'vite') {
    const { getViteE2EWebServerInfo, getReactRouterE2EWebServerInfo } =
      ensurePackage<typeof import('@nx/vite')>('@nx/vite', nxVersion);
    e2eWebServerInfo = options.useReactRouter
      ? await getReactRouterE2EWebServerInfo(
          tree,
          options.projectName,
          joinPathFragments(
            options.appProjectRoot,
            `vite.config.${options.js ? 'js' : 'ts'}`
          ),
          options.addPlugin,
          options.devServerPort ?? 4200
        )
      : await getViteE2EWebServerInfo(
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

      const packageJson: PackageJson = {
        name: options.e2eProjectName,
        version: '0.0.1',
        private: true,
      };

      if (!options.useProjectJson) {
        packageJson.nx = {
          implicitDependencies: [options.projectName],
        };
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

      if (!options.useProjectJson || options.isUsingTsSolutionConfig) {
        writeJson(
          tree,
          joinPathFragments(options.e2eProjectRoot, 'package.json'),
          packageJson
        );
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
        webServerCommands: {
          default: e2eWebServerInfo.e2eWebServerCommand,
          production: e2eWebServerInfo.e2eCiWebServerCommand,
        },
        ciWebServerCommand: e2eWebServerInfo.e2eCiWebServerCommand,
        ciBaseUrl: e2eWebServerInfo.e2eCiBaseUrl,
      });

      return e2eTask;
    }
    case 'playwright': {
      const { configurationGenerator } = ensurePackage<
        typeof import('@nx/playwright')
      >('@nx/playwright', nxVersion);

      const packageJson: PackageJson = {
        name: options.e2eProjectName,
        version: '0.0.1',
        private: true,
      };

      if (!options.useProjectJson) {
        packageJson.nx = {
          implicitDependencies: [options.projectName],
        };
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

      if (!options.useProjectJson || options.isUsingTsSolutionConfig) {
        writeJson(
          tree,
          joinPathFragments(options.e2eProjectRoot, 'package.json'),
          packageJson
        );
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

      return e2eTask;
    }
    case 'none':
    default:
      return () => {};
  }
}
