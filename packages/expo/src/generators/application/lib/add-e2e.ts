import {
  getE2EWebServerInfo,
  readTargetDefaultsForTarget,
  type PackageJson,
} from '@nx/devkit/internal';
import {
  addProjectConfiguration,
  ensurePackage,
  GeneratorCallback,
  joinPathFragments,
  readNxJson,
  Tree,
  writeJson,
} from '@nx/devkit';
import { nxVersion } from '../../../utils/versions';
import { NormalizedSchema } from './normalize-options';

export async function addE2e(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const e2eWebServerInfo = await getExpoE2EWebServerInfo(
    tree,
    options.projectName,
    joinPathFragments(options.appProjectRoot, 'app.json')
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
        enableTypedLinting: options.enableTypedLinting,
        webServerCommand: e2eWebServerInfo.e2eWebServerCommand,
        webServerAddress: e2eWebServerInfo.e2eWebServerAddress,
        ciWebServerCommand: e2eWebServerInfo.e2eCiWebServerCommand,
        ciWebServerAddress: e2eWebServerInfo.e2eCiBaseUrl,
        rootProject: options.rootProject,
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
  configFilePath: string
) {
  const nxJson = readNxJson(tree);
  let e2ePort = 8081;
  const serveTargetOptions = readTargetDefaultsForTarget(
    'serve',
    nxJson.targetDefaults
  )?.options;

  if (serveTargetOptions?.port) {
    e2ePort = serveTargetOptions.port;
  }

  const info = await getE2EWebServerInfo(
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
    }
  );

  // The plugin infers no serve-static target, so CI runs the dev server
  return {
    ...info,
    e2eCiWebServerCommand: info.e2eWebServerCommand,
    e2eCiBaseUrl: info.e2eWebServerAddress,
  };
}
