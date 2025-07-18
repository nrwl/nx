import {
  addProjectConfiguration,
  ensurePackage,
  joinPathFragments,
  readNxJson,
  Tree,
  writeJson,
} from '@nx/devkit';
import { getE2EWebServerInfo } from '@nx/devkit/src/generators/e2e-web-server-info-utils';
import { webStaticServeGenerator } from '@nx/web';
import type { PackageJson } from 'nx/src/utils/package-json';
import { nxVersion } from '../../../utils/versions';
import { NormalizedSchema } from './normalize-options';
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
      addProjectConfiguration(host, options.e2eProjectName, {
        root: options.e2eProjectRoot,
        projectType: 'application',
        sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
        targets: {},
        tags: [],
        implicitDependencies: [options.projectName],
      });
    }

    if (!options.useProjectJson || options.isTsSolutionSetup) {
      writeJson(
        host,
        joinPathFragments(options.e2eProjectRoot, 'package.json'),
        packageJson
      );
    }

    const e2eTask = await configurationGenerator(host, {
      ...options,
      linter: 'eslint',
      project: options.e2eProjectName,
      directory: 'src',
      skipFormat: true,
      devServerTarget: e2eWebServerInfo.e2eDevServerTarget,
      baseUrl: e2eWebServerInfo.e2eWebServerAddress,
      jsx: true,
      webServerCommands: {
        default: e2eWebServerInfo.e2eWebServerCommand,
      },
      ciWebServerCommand: e2eWebServerInfo.e2eCiWebServerCommand,
      ciBaseUrl: e2eWebServerInfo.e2eCiBaseUrl,
    });

    return e2eTask;
  } else if (options.e2eTestRunner === 'playwright') {
    let playwrightPkg: typeof import('@nx/playwright');
    try {
      playwrightPkg = ensurePackage<typeof playwrightPkg>(
        '@nx/playwright',
        nxVersion
      );
    } catch (e) {
      if (e instanceof Error && e.cause === ERR_MODULE_NOT_FOUND) {
        console.log(
          'NOTE: @nx/playwright couldn\'t be found in this project\'s dependencies and will be installed once you remove the "dryRun" flag (or once you hit the "Generate" button if you are running this in Nx Console)'
        );
      }
    }

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
      addProjectConfiguration(host, options.e2eProjectName, {
        root: options.e2eProjectRoot,
        projectType: 'application',
        sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
        targets: {},
        tags: [],
        implicitDependencies: [options.projectName],
      });
    }

    if (!options.useProjectJson || options.isTsSolutionSetup) {
      writeJson(
        host,
        joinPathFragments(options.e2eProjectRoot, 'package.json'),
        packageJson
      );
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
