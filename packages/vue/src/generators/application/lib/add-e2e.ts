import type { GeneratorCallback, Tree } from '@nx/devkit';
import { E2EWebServerDetails } from '@nx/devkit/internal';
import { isTypedLintingEnabled } from '@nx/eslint/internal';
import {
  addProjectConfiguration,
  ensurePackage,
  joinPathFragments,
  readNxJson,
  writeJson,
} from '@nx/devkit';
import { webStaticServeGenerator } from '@nx/web';

import { nxVersion } from '../../../utils/versions';
import { hasRsbuildPlugin } from '../../../utils/has-rsbuild-plugin';
import { NormalizedSchema } from '../schema';
import type { PackageJson } from 'nx/src/utils/package-json';

export async function addE2e(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const nxJson = readNxJson(tree);
  const hasPlugin =
    options.bundler === 'rsbuild'
      ? await hasRsbuildPlugin(tree, options.appProjectRoot)
      : nxJson.plugins?.find((p) =>
          typeof p === 'string'
            ? p === '@nx/vite/plugin'
            : p.plugin === '@nx/vite/plugin'
        );
  let e2eWebServerInfo: E2EWebServerDetails;
  if (options.bundler === 'vite') {
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
    // `require()` honors Module._initPaths (which ensurePackage updates); ESM
    // dynamic `import()` doesn't, so it can't see the on-demand temp install.
    const {
      getRsbuildE2EWebServerInfo,
    }: typeof import('@nx/rsbuild/config-utils') = require('@nx/rsbuild/config-utils');
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

  switch (options.e2eTestRunner) {
    case 'cypress': {
      if (!hasPlugin) {
        await webStaticServeGenerator(tree, {
          buildTarget: `${options.projectName}:build`,
          targetName: 'serve-static',
          spa: true,
        });
      }

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
          tags: [],
          implicitDependencies: [options.projectName],
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
        bundler: 'vite',
        skipFormat: true,
        devServerTarget: e2eWebServerInfo.e2eDevServerTarget,
        baseUrl: e2eWebServerInfo.e2eWebServerAddress,
        jsx: true,
        enableTypedLinting: isTypedLintingEnabled(options),
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
        skipFormat: true,
        skipPackageJson: options.skipPackageJson,
        directory: 'src',
        js: false,
        linter: options.linter,
        enableTypedLinting: isTypedLintingEnabled(options),
        webServerCommand: e2eWebServerInfo.e2eCiWebServerCommand,
        webServerAddress: e2eWebServerInfo.e2eCiBaseUrl,
      });

      return e2eTask;
    }
    case 'none':
    default:
      return () => {};
  }
}
