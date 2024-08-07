import {
  addProjectConfiguration,
  ensurePackage,
  getPackageManagerCommand,
  joinPathFragments,
  Tree,
} from '@nx/devkit';
import { nxVersion } from '../../../utils/versions';
import { NormalizedSchema } from '../schema';
import { findPluginForConfigFile } from '@nx/devkit/src/utils/find-plugin-for-config-file';
import { addE2eCiTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';

export async function addE2e(host: Tree, options: NormalizedSchema) {
  if (options.e2eTestRunner === 'cypress') {
    const { configurationGenerator } = ensurePackage<
      typeof import('@nx/cypress')
    >('@nx/cypress', nxVersion);
    addProjectConfiguration(host, options.e2eProjectName, {
      projectType: 'application',
      root: options.e2eProjectRoot,
      sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
      targets: {},
      tags: [],
      implicitDependencies: [options.projectName],
    });
    const e2eTask = await configurationGenerator(host, {
      ...options,
      project: options.e2eProjectName,
      directory: 'src',
      bundler: 'vite',
      skipFormat: true,
      devServerTarget: `${options.projectName}:${options.e2eWebServerTarget}`,
      webServerCommands: {
        default: `${getPackageManagerCommand().exec} nx ${
          options.e2eWebServerTarget
        } ${options.projectName}`,
      },
      ciWebServerCommand: `nx run ${options.projectName}:serve-static`,
      baseUrl: options.e2eWebServerAddress,
      jsx: true,
      addPlugin: true,
    });

    let buildTarget = '^build-static';
    const matchingPlugin = await findPluginForConfigFile(
      host,
      '@nx/nuxt/plugin',
      joinPathFragments(
        options.appProjectRoot,
        `nuxt.config.${options.js ? 'js' : 'ts'}`
      )
    );
    if (matchingPlugin && typeof matchingPlugin !== 'string') {
      buildTarget = `^${
        (matchingPlugin.options as any)?.buildStaticTargetName ?? 'build-static'
      }`;
    }

    await addE2eCiTargetDefaults(
      host,
      '@nx/cypress/plugin',
      buildTarget,
      joinPathFragments(
        options.e2eProjectRoot,
        `cypress.config.${options.js ? 'js' : 'ts'}`
      )
    );

    return e2eTask;
  } else if (options.e2eTestRunner === 'playwright') {
    const { configurationGenerator } = ensurePackage<
      typeof import('@nx/playwright')
    >('@nx/playwright', nxVersion);
    addProjectConfiguration(host, options.e2eProjectName, {
      root: options.e2eProjectRoot,
      sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
      targets: {},
      implicitDependencies: [options.projectName],
    });
    const e2eTask = await configurationGenerator(host, {
      project: options.e2eProjectName,
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
      directory: 'src',
      js: false,
      linter: options.linter,
      setParserOptionsProject: options.setParserOptionsProject,
      webServerAddress: options.e2eWebServerAddress,
      webServerCommand: `${getPackageManagerCommand().exec} nx ${
        options.e2eWebServerTarget
      } ${options.projectName}`,
      addPlugin: true,
    });

    let buildTarget = '^build-static';
    const matchingPlugin = await findPluginForConfigFile(
      host,
      '@nx/nuxt/plugin',
      joinPathFragments(
        options.appProjectRoot,
        `nuxt.config.${options.js ? 'js' : 'ts'}`
      )
    );
    if (matchingPlugin && typeof matchingPlugin !== 'string') {
      buildTarget = `^${
        (matchingPlugin.options as any)?.buildStaticTargetName ?? 'build-static'
      }`;
    }

    await addE2eCiTargetDefaults(
      host,
      '@nx/playwright/plugin',
      buildTarget,
      joinPathFragments(options.e2eProjectRoot, `playwright.config.ts`)
    );

    return e2eTask;
  }
  return () => {};
}
