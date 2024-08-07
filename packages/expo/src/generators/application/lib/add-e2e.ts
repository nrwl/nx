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
import { hasExpoPlugin } from '../../../utils/has-expo-plugin';
import { NormalizedSchema } from './normalize-options';
import { addE2eCiTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import { findPluginForConfigFile } from '@nx/devkit/src/utils/find-plugin-for-config-file';

export async function addE2e(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const hasPlugin = hasExpoPlugin(tree);
  switch (options.e2eTestRunner) {
    case 'cypress': {
      if (!hasPlugin) {
        await webStaticServeGenerator(tree, {
          buildTarget: `${options.projectName}:export`,
          targetName: 'serve-static',
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
        implicitDependencies: [options.projectName],
        tags: [],
      });

      const e2eTask = await configurationGenerator(tree, {
        ...options,
        project: options.e2eProjectName,
        directory: 'src',
        // the name and root are already normalized, instruct the generator to use them as is
        bundler: 'none',
        skipFormat: true,
        devServerTarget: `${options.projectName}:${options.e2eWebServerTarget}`,
        port: options.e2ePort,
        baseUrl: options.e2eWebServerAddress,
        ciWebServerCommand: hasPlugin
          ? `nx run ${options.projectName}:serve-static`
          : undefined,
        jsx: true,
        rootProject: options.rootProject,
      });

      if (
        options.addPlugin ||
        readNxJson(tree).plugins?.find((p) =>
          typeof p === 'string'
            ? p === '@nx/cypress/plugin'
            : p.plugin === '@nx/cypress/plugin'
        )
      ) {
        let buildTarget = '^export';
        if (hasPlugin) {
          const matchingExpoPlugin = await findPluginForConfigFile(
            tree,
            '@nx/expo/plugin',
            joinPathFragments(options.appProjectRoot, 'app.json')
          );
          if (matchingExpoPlugin && typeof matchingExpoPlugin !== 'string') {
            buildTarget = `^${
              (matchingExpoPlugin.options as any)?.exportTargetName ?? 'export'
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
        let buildTarget = '^export';
        if (hasPlugin) {
          const matchingExpoPlugin = await findPluginForConfigFile(
            tree,
            '@nx/expo/plugin',
            joinPathFragments(options.appProjectRoot, 'app.json')
          );
          if (matchingExpoPlugin && typeof matchingExpoPlugin !== 'string') {
            buildTarget = `^${
              (matchingExpoPlugin.options as any)?.exportTargetName ?? 'export'
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
    case 'detox':
      const { detoxApplicationGenerator } = ensurePackage<
        typeof import('@nx/detox')
      >('@nx/detox', nxVersion);
      return detoxApplicationGenerator(tree, {
        ...options,
        e2eName: options.e2eProjectName,
        e2eDirectory: options.e2eProjectRoot,
        projectNameAndRootFormat: 'as-provided',
        appProject: options.projectName,
        appDisplayName: options.displayName,
        appName: options.name,
        framework: 'expo',
        setParserOptionsProject: options.setParserOptionsProject,
        skipFormat: true,
      });
    case 'none':
    default:
      return () => {};
  }
}
