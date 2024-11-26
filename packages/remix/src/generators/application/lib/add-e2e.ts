import {
  type Tree,
  addProjectConfiguration,
  joinPathFragments,
  ensurePackage,
  readNxJson,
} from '@nx/devkit';
import { type NormalizedSchema } from './normalize-options';
import { getPackageVersion } from '../../../utils/versions';
import { findPluginForConfigFile } from '@nx/devkit/src/utils/find-plugin-for-config-file';
import { addE2eCiTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import { getE2EWebServerInfo } from '@nx/devkit/src/generators/e2e-web-server-info-utils';

export async function addE2E(tree: Tree, options: NormalizedSchema) {
  const hasRemixPlugin = readNxJson(tree).plugins?.find((p) =>
    typeof p === 'string'
      ? p === '@nx/remix/plugin'
      : p.plugin === '@nx/remix/plugin'
  );

  let e2eWebsServerInfo = await getRemixE2EWebServerInfo(
    tree,
    options.projectName,
    joinPathFragments(options.projectRoot, 'remix.config.js'),
    options.addPlugin ?? Boolean(hasRemixPlugin)
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
      devServerTarget: e2eWebsServerInfo.e2eDevServerTarget,
      baseUrl: e2eWebsServerInfo.e2eWebServerAddress,
      webServerCommands: hasRemixPlugin
        ? {
            default: e2eWebsServerInfo.e2eWebServerCommand,
            production: e2eWebsServerInfo.e2eCiWebServerCommand,
          }
        : undefined,
      ciWebServerCommand: hasRemixPlugin
        ? e2eWebsServerInfo.e2eCiWebServerCommand
        : undefined,
      ciBaseUrl: e2eWebsServerInfo.e2eCiBaseUrl,
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
      webServerCommand: e2eWebsServerInfo.e2eCiWebServerCommand,
      webServerAddress: e2eWebsServerInfo.e2eCiBaseUrl,
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

async function getRemixE2EWebServerInfo(
  tree: Tree,
  projectName: string,
  configFilePath: string,
  isPluginBeingAdded: boolean
) {
  const nxJson = readNxJson(tree);
  let e2ePort = isPluginBeingAdded ? 3000 : 4200;

  const defaultServeTarget = isPluginBeingAdded ? 'dev' : 'serve';

  if (
    nxJson.targetDefaults?.[defaultServeTarget] &&
    nxJson.targetDefaults?.[defaultServeTarget].options?.port
  ) {
    e2ePort = nxJson.targetDefaults?.[defaultServeTarget].options?.port;
  }

  return getE2EWebServerInfo(
    tree,
    projectName,
    {
      plugin: '@nx/remix/plugin',
      serveTargetName: 'serveTargetName',
      serveStaticTargetName: 'serveStaticTargetName',
      configFilePath,
    },
    {
      defaultServeTargetName: defaultServeTarget,
      defaultServeStaticTargetName: 'serve-static',
      defaultE2EWebServerAddress: `http://localhost:${e2ePort}`,
      defaultE2ECiBaseUrl: 'http://localhost:3000',
      defaultE2EPort: e2ePort,
    },
    isPluginBeingAdded
  );
}
