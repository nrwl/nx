import {
  addProjectConfiguration,
  ensurePackage,
  joinPathFragments,
  readNxJson,
  Tree,
  writeJson,
} from '@nx/devkit';
import { getE2EWebServerInfo } from '@nx/devkit/src/generators/e2e-web-server-info-utils';
import { nxVersion } from '../../../utils/versions';
import { NormalizedSchema } from '../schema';
import type { PackageJson } from 'nx/src/utils/package-json';

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
        host,
        joinPathFragments(options.e2eProjectRoot, 'package.json'),
        packageJson
      );
    }

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

    return e2eTask;
  } else if (options.e2eTestRunner === 'playwright') {
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
      addProjectConfiguration(host, options.e2eProjectName, {
        projectType: 'application',
        root: options.e2eProjectRoot,
        sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
        targets: {},
        implicitDependencies: [options.projectName],
      });
    }

    if (!options.useProjectJson || options.isUsingTsSolutionConfig) {
      writeJson(
        host,
        joinPathFragments(options.e2eProjectRoot, 'package.json'),
        packageJson
      );
    }

    const e2eTask = await configurationGenerator(host, {
      project: options.e2eProjectName,
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
      directory: 'src',
      js: false,
      linter: options.linter,
      setParserOptionsProject: options.setParserOptionsProject,
      webServerAddress: e2eWebServerInfo.e2eCiBaseUrl,
      webServerCommand: e2eWebServerInfo.e2eCiWebServerCommand,
      addPlugin: true,
    });

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
