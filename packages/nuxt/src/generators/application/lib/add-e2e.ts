import {
  addProjectConfiguration,
  ensurePackage,
  getPackageManagerCommand,
  joinPathFragments,
  readNxJson,
  Tree,
} from '@nx/devkit';
import { getE2EWebServerInfo } from '@nx/devkit/src/generators/e2e-web-server-info-utils';
import { nxVersion } from '../../../utils/versions';
import { NormalizedSchema } from '../schema';
import { findPluginForConfigFile } from '@nx/devkit/src/utils/find-plugin-for-config-file';
import { addE2eCiTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';

export async function addE2e(host: Tree, options: NormalizedSchema) {
  const e2eWebServerInfo = await getNuxtE2EWebServerInfo(
    host,
    options.projectName,
    joinPathFragments(
      options.appProjectRoot,
      `nuxt.config.${options.js ? 'js' : 'ts'}`
    )
  );
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
      devServerTarget: e2eWebServerInfo.e2eDevServerTarget,
      webServerCommands: {
        default: e2eWebServerInfo.e2eWebServerCommand,
      },
      ciWebServerCommand: e2eWebServerInfo.e2eCiWebServerCommand,
      baseUrl: e2eWebServerInfo.e2eWebServerAddress,
      ciBaseUrl: e2eWebServerInfo.e2eCiBaseUrl,
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
      webServerAddress: e2eWebServerInfo.e2eCiWebServerCommand,
      webServerCommand: e2eWebServerInfo.e2eCiBaseUrl,
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

async function getNuxtE2EWebServerInfo(
  tree: Tree,
  projectName: string,
  configFilePath: string
) {
  const nxJson = readNxJson(tree);
  let e2ePort = 4200;

  if (
    nxJson.targetDefaults?.['serve'] &&
    nxJson.targetDefaults?.['serve'].options?.port
  ) {
    e2ePort = nxJson.targetDefaults?.['serve'].options?.port;
  }

  return getE2EWebServerInfo(
    tree,
    projectName,
    {
      plugin: '@nx/nuxt/plugin',
      serveTargetName: 'serveTargetName',
      serveStaticTargetName: 'serveStaticTargetName',
      configFilePath,
    },
    {
      defaultServeTargetName: 'serve',
      defaultServeStaticTargetName: 'serve-static',
      defaultE2EWebServerAddress: `http://localhost:${e2ePort}`,
      defaultE2ECiBaseUrl: 'http://localhost:4200',
      defaultE2EPort: e2ePort,
    },
    true
  );
}
