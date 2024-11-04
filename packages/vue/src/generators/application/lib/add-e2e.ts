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
import { NormalizedSchema } from '../schema';
import { findPluginForConfigFile } from '@nx/devkit/src/utils/find-plugin-for-config-file';
import { addE2eCiTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';

export async function addE2e(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const nxJson = readNxJson(tree);
  const hasPlugin = nxJson.plugins?.find((p) =>
    typeof p === 'string'
      ? p === '@nx/vite/plugin'
      : p.plugin === '@nx/vite/plugin'
  );
  const { getViteE2EWebServerInfo } = ensurePackage<typeof import('@nx/vite')>(
    '@nx/vite',
    nxVersion
  );
  const e2eWebServerInfo = await getViteE2EWebServerInfo(
    tree,
    options.projectName,
    joinPathFragments(
      options.appProjectRoot,
      `vite.config.${options.js ? 'js' : 'ts'}`
    ),
    options.addPlugin,
    options.devServerPort ?? 4200
  );

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
      addProjectConfiguration(tree, options.e2eProjectName, {
        projectType: 'application',
        root: options.e2eProjectRoot,
        sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
        targets: {},
        tags: [],
        implicitDependencies: [options.projectName],
      });
      const e2eTask = await configurationGenerator(tree, {
        ...options,
        project: options.e2eProjectName,
        directory: 'src',
        bundler: 'vite',
        skipFormat: true,
        devServerTarget: e2eWebServerInfo.e2eDevServerTarget,
        baseUrl: e2eWebServerInfo.e2eWebServerAddress,
        jsx: true,
        webServerCommands: hasPlugin
          ? {
              default: e2eWebServerInfo.e2eWebServerCommand,
              production: e2eWebServerInfo.e2eCiWebServerCommand,
            }
          : undefined,
        ciWebServerCommand: e2eWebServerInfo.e2eCiWebServerCommand,
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
        if (hasPlugin) {
          const matchingPlugin = await findPluginForConfigFile(
            tree,
            `@nx/vite/plugin`,
            joinPathFragments(
              options.appProjectRoot,
              `vite.config.${options.js ? 'js' : 'ts'}`
            )
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
        ...options,
        project: options.e2eProjectName,
        skipFormat: true,
        skipPackageJson: options.skipPackageJson,
        directory: 'src',
        js: false,
        linter: options.linter,
        setParserOptionsProject: options.setParserOptionsProject,
        webServerCommand: e2eWebServerInfo.e2eCiWebServerCommand,
        webServerAddress: e2eWebServerInfo.e2eCiBaseUrl,
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
        if (hasPlugin) {
          const matchingPlugin = await findPluginForConfigFile(
            tree,
            `@nx/vite/plugin`,
            joinPathFragments(
              options.appProjectRoot,
              `vite.config.${options.js ? 'js' : 'ts'}`
            )
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
