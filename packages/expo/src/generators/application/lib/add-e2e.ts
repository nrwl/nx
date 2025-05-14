import {
  addProjectConfiguration,
  ensurePackage,
  GeneratorCallback,
  joinPathFragments,
  readNxJson,
  Tree,
  writeJson,
} from '@nx/devkit';
import { getE2EWebServerInfo } from '@nx/devkit/src/generators/e2e-web-server-info-utils';
import { webStaticServeGenerator } from '@nx/web';
import type { PackageJson } from 'nx/src/utils/package-json';
import { hasExpoPlugin } from '../../../utils/has-expo-plugin';
import { nxVersion } from '../../../utils/versions';
import { NormalizedSchema } from './normalize-options';

export async function addE2e(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const hasPlugin = hasExpoPlugin(tree);
  if (!hasPlugin) {
    await webStaticServeGenerator(tree, {
      buildTarget: `${options.projectName}:export`,
      targetName: 'serve-static',
    });
  }

  const e2eWebServerInfo = await getExpoE2EWebServerInfo(
    tree,
    options.projectName,
    joinPathFragments(options.appProjectRoot, 'app.json'),
    options.addPlugin
  );

  switch (options.e2eTestRunner) {
    case 'cypress': {
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
          implicitDependencies: [options.projectName],
          tags: [],
        });
      }

      if (!options.useProjectJson || options.isTsSolutionSetup) {
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
        // the name and root are already normalized, instruct the generator to use them as is
        bundler: 'none',
        skipFormat: true,
        devServerTarget: e2eWebServerInfo.e2eDevServerTarget,
        baseUrl: e2eWebServerInfo.e2eWebServerAddress,
        ciWebServerCommand: e2eWebServerInfo.e2eCiWebServerCommand,
        webServerCommands: {
          default: e2eWebServerInfo.e2eWebServerCommand,
          production: e2eWebServerInfo.e2eCiWebServerCommand,
        },
        ciBaseUrl: e2eWebServerInfo.e2eCiBaseUrl,
        jsx: true,
        rootProject: options.rootProject,
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
          tags: [],
        });
      }

      if (!options.useProjectJson || options.isTsSolutionSetup) {
        writeJson(
          tree,
          joinPathFragments(options.e2eProjectRoot, 'package.json'),
          packageJson
        );
      }

      const e2eTask = await configurationGenerator(tree, {
        project: options.e2eProjectName,
        skipFormat: true,
        skipPackageJson: options.skipPackageJson,
        directory: 'src',
        js: false,
        linter: options.linter,
        setParserOptionsProject: options.setParserOptionsProject,
        webServerCommand: e2eWebServerInfo.e2eCiWebServerCommand,
        webServerAddress: e2eWebServerInfo.e2eCiBaseUrl,
        rootProject: options.rootProject,
        addPlugin: options.addPlugin,
      });

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
        appProject: options.projectName,
        appDisplayName: options.displayName,
        appName: options.simpleName,
        framework: 'expo',
        setParserOptionsProject: options.setParserOptionsProject,
        skipFormat: true,
      });
    case 'none':
    default:
      return () => {};
  }
}

async function getExpoE2EWebServerInfo(
  tree: Tree,
  projectName: string,
  configFilePath: string,
  isPluginBeingAdded: boolean
) {
  const nxJson = readNxJson(tree);
  let e2ePort = isPluginBeingAdded ? 8081 : 4200;

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
      plugin: '@nx/expo/plugin',
      serveTargetName: 'serveTargetName',
      serveStaticTargetName: 'serveTargetName',
      configFilePath,
    },
    {
      defaultServeTargetName: 'serve',
      defaultServeStaticTargetName: 'serve-static',
      defaultE2EWebServerAddress: `http://localhost:${e2ePort}`,
      defaultE2ECiBaseUrl: 'http://localhost:4200',
      defaultE2EPort: e2ePort,
    },
    isPluginBeingAdded
  );
}
