import {
  addProjectConfiguration,
  ensurePackage,
  joinPathFragments,
  readNxJson,
  Tree,
  writeJson,
} from '@nx/devkit';
import { Linter } from '@nx/eslint';

import { nxVersion } from '../../../utils/versions';
import { NormalizedSchema } from './normalize-options';
import { webStaticServeGenerator } from '@nx/web';
import { findPluginForConfigFile } from '@nx/devkit/src/utils/find-plugin-for-config-file';
import { addE2eCiTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import { getE2EWebServerInfo } from '@nx/devkit/src/generators/e2e-web-server-info-utils';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { ERR_MODULE_NOT_FOUND } from '@nx/devkit/src/utils/package-json';

export async function addE2e(host: Tree, options: NormalizedSchema) {
  const nxJson = readNxJson(host);
  const hasPlugin = nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/next/plugin'
      : p.plugin === '@nx/next/plugin'
  );

  const e2eWebServerInfo = await getNextE2EWebServerInfo(
    host,
    options.projectName,
    joinPathFragments(options.appProjectRoot, 'next.config.js'),
    options.addPlugin
  );

  if (options.e2eTestRunner === 'cypress') {
    const { configurationGenerator } = ensurePackage<
      typeof import('@nx/cypress')
    >('@nx/cypress', nxVersion);

    if (!hasPlugin) {
      await webStaticServeGenerator(host, {
        buildTarget: `${options.projectName}:build`,
        outputPath: `${options.outputPath}/out`,
        targetName: 'serve-static',
        spa: true,
      });
    }

    if (isUsingTsSolutionSetup(host)) {
      writeJson(
        host,
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
      addProjectConfiguration(host, options.e2eProjectName, {
        root: options.e2eProjectRoot,
        projectType: 'application',
        sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
        targets: {},
        tags: [],
        implicitDependencies: [options.projectName],
      });
    }

    const e2eTask = await configurationGenerator(host, {
      ...options,
      linter: Linter.EsLint,
      project: options.e2eProjectName,
      directory: 'src',
      skipFormat: true,
      devServerTarget: e2eWebServerInfo.e2eDevServerTarget,
      baseUrl: e2eWebServerInfo.e2eWebServerAddress,
      jsx: true,
      webServerCommands: hasPlugin
        ? {
            default: e2eWebServerInfo.e2eWebServerCommand,
          }
        : undefined,
      ciWebServerCommand: e2eWebServerInfo.e2eCiWebServerCommand,
      ciBaseUrl: e2eWebServerInfo.e2eCiBaseUrl,
    });

    if (
      options.addPlugin ||
      readNxJson(host).plugins?.find((p) =>
        typeof p === 'string'
          ? p === '@nx/cypress/plugin'
          : p.plugin === '@nx/cypress/plugin'
      )
    ) {
      let buildTarget = '^build';
      if (hasPlugin) {
        const matchingPlugin = await findPluginForConfigFile(
          host,
          '@nx/next/plugin',
          joinPathFragments(options.appProjectRoot, 'next.config.js')
        );
        if (matchingPlugin && typeof matchingPlugin !== 'string') {
          buildTarget = `^${
            (matchingPlugin.options as any)?.buildTargetName ?? 'build'
          }`;
        }
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
    }

    return e2eTask;
  } else if (options.e2eTestRunner === 'playwright') {
    let playwrightPkg: typeof import('@nx/playwright');
    try {
      playwrightPkg = ensurePackage<
        typeof playwrightPkg
      >('@nx/playwright', nxVersion);
    }
    catch (e) {
      if (e instanceof Error && e.cause === ERR_MODULE_NOT_FOUND) {
        console.log("NOTE: @nx/playwright couldn't be found in this project's dependencies and will be installed once you remove the \"dryRun\" flag (or once you hit the \"Generate\" button if you are running this in Nx Console)")
      }
    }

    if (isUsingTsSolutionSetup(host)) {
      writeJson(
        host,
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
      addProjectConfiguration(host, options.e2eProjectName, {
        root: options.e2eProjectRoot,
        projectType: 'application',
        sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
        targets: {},
        tags: [],
        implicitDependencies: [options.projectName],
      });
    }

    const e2eTask = await playwrightPkg.configurationGenerator(host, {
      rootProject: options.rootProject,
      project: options.e2eProjectName,
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
      directory: 'src',
      js: false,
      linter: options.linter,
      setParserOptionsProject: options.setParserOptionsProject,
      webServerAddress: e2eWebServerInfo.e2eCiBaseUrl,
      webServerCommand: e2eWebServerInfo.e2eCiWebServerCommand,
      addPlugin: options.addPlugin,
    });

    if (
      options.addPlugin ||
      readNxJson(host).plugins?.find((p) =>
        typeof p === 'string'
          ? p === '@nx/playwright/plugin'
          : p.plugin === '@nx/playwright/plugin'
      )
    ) {
      let buildTarget = '^build';
      if (hasPlugin) {
        const matchingPlugin = await findPluginForConfigFile(
          host,
          '@nx/next/plugin',
          joinPathFragments(options.appProjectRoot, 'next.config.js')
        );
        if (matchingPlugin && typeof matchingPlugin !== 'string') {
          buildTarget = `^${
            (matchingPlugin.options as any)?.buildTargetName ?? 'build'
          }`;
        }
      }
      await addE2eCiTargetDefaults(
        host,
        '@nx/playwright/plugin',
        buildTarget,
        joinPathFragments(options.e2eProjectRoot, `playwright.config.ts`)
      );
    }

    return e2eTask;
  }
  return () => {};
}

async function getNextE2EWebServerInfo(
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
      plugin: '@nx/next/plugin',
      serveTargetName: 'devTargetName',
      serveStaticTargetName: 'startTargetName',
      configFilePath,
    },
    {
      defaultServeTargetName: defaultServeTarget,
      defaultServeStaticTargetName: 'start',
      defaultE2EWebServerAddress: `http://127.0.0.1:${e2ePort}`,
      defaultE2ECiBaseUrl: `http://localhost:${e2ePort}`,
      defaultE2EPort: e2ePort,
    },
    isPluginBeingAdded
  );
}
