import {
  type Tree,
  addProjectConfiguration,
  joinPathFragments,
  ensurePackage,
  GeneratorCallback,
  readNxJson,
  writeJson,
} from '@nx/devkit';
import { type NormalizedSchema } from './normalize-options';
import { getPackageVersion } from '../../../utils/versions';
import { getE2EWebServerInfo } from '@nx/devkit/src/generators/e2e-web-server-info-utils';
import type { PackageJson } from 'nx/src/utils/package-json';

export async function addE2E(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
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
      project: options.e2eProjectName,
      directory: 'src',
      skipFormat: true,
      devServerTarget: e2eWebsServerInfo.e2eDevServerTarget,
      baseUrl: e2eWebsServerInfo.e2eWebServerAddress,
      webServerCommands: {
        default: e2eWebsServerInfo.e2eWebServerCommand,
        production: e2eWebsServerInfo.e2eCiWebServerCommand,
      },
      ciWebServerCommand: e2eWebsServerInfo.e2eCiWebServerCommand,
      ciBaseUrl: e2eWebsServerInfo.e2eCiBaseUrl,
      addPlugin: options.addPlugin,
    });

    return e2eTask;
  } else if (options.e2eTestRunner === 'playwright') {
    const { configurationGenerator } = ensurePackage<
      typeof import('@nx/playwright')
    >('@nx/playwright', getPackageVersion(tree, 'nx'));

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
