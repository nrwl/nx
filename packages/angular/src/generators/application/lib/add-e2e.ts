import { E2EWebServerDetails, getE2EWebServerInfo, Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  ensurePackage,
  getPackageManagerCommand,
  joinPathFragments,
  readNxJson,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import { nxVersion } from '../../../utils/versions';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { NormalizedSchema } from './normalized-schema';
import { addE2eCiTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';

export async function addE2e(tree: Tree, options: NormalizedSchema) {
  // since e2e are separate projects, default to adding plugins
  const nxJson = readNxJson(tree);
  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  const e2eWebServerInfo = getAngularE2EWebServerInfo(
    tree,
    options.name,
    options.port
  );
  // TODO: This can call `@nx/web:static-config` generator when ready
  addFileServerTarget(tree, options, 'serve-static', e2eWebServerInfo.e2ePort);

  if (options.e2eTestRunner === 'cypress') {
    const { configurationGenerator } = ensurePackage<
      typeof import('@nx/cypress')
    >('@nx/cypress', nxVersion);

    addProjectConfiguration(tree, options.e2eProjectName, {
      projectType: 'application',
      root: options.e2eProjectRoot,
      sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
      targets: {},
      tags: [],
      implicitDependencies: [options.name],
    });
    await configurationGenerator(tree, {
      project: options.e2eProjectName,
      directory: 'src',
      linter: options.linter,
      skipPackageJson: options.skipPackageJson,
      skipFormat: true,
      devServerTarget: e2eWebServerInfo.e2eDevServerTarget,
      baseUrl: e2eWebServerInfo.e2eWebServerAddress,
      webServerCommands: {
        default: e2eWebServerInfo.e2eWebServerCommand,
        production: e2eWebServerInfo.e2eCiWebServerCommand,
      },
      ciWebServerCommand: e2eWebServerInfo.e2eCiWebServerCommand,
      ciBaseUrl: e2eWebServerInfo.e2eCiBaseUrl,
      rootProject: options.rootProject,
      addPlugin,
    });
    if (addPlugin) {
      await addE2eCiTargetDefaults(
        tree,
        '@nx/cypress/plugin',
        '^build',
        joinPathFragments(options.e2eProjectRoot, 'cypress.config.ts')
      );
    }
  } else if (options.e2eTestRunner === 'playwright') {
    const { configurationGenerator } = ensurePackage<
      typeof import('@nx/playwright')
    >('@nx/playwright', nxVersion);
    addProjectConfiguration(tree, options.e2eProjectName, {
      projectType: 'application',
      root: options.e2eProjectRoot,
      sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
      targets: {},
      implicitDependencies: [options.name],
    });
    await configurationGenerator(tree, {
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
      addPlugin,
    });
    if (addPlugin) {
      await addE2eCiTargetDefaults(
        tree,
        '@nx/playwright/plugin',
        '^build',
        joinPathFragments(options.e2eProjectRoot, 'playwright.config.ts')
      );
    }
  }
}

function addFileServerTarget(
  tree: Tree,
  options: NormalizedSchema,
  targetName: string,
  e2ePort: number
) {
  if (!options.skipPackageJson) {
    addDependenciesToPackageJson(tree, {}, { '@nx/web': nxVersion });
  }

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  const isUsingApplicationBuilder =
    angularMajorVersion >= 17 && options.bundler === 'esbuild';

  const projectConfig = readProjectConfiguration(tree, options.name);
  projectConfig.targets[targetName] = {
    executor: '@nx/web:file-server',
    options: {
      buildTarget: `${options.name}:build`,
      port: e2ePort,
      staticFilePath: isUsingApplicationBuilder
        ? joinPathFragments(options.outputPath, 'browser')
        : undefined,
      spa: true,
    },
  };
  updateProjectConfiguration(tree, options.name, projectConfig);
}

function getAngularE2EWebServerInfo(
  tree: Tree,
  projectName: string,
  portOverride: number
): E2EWebServerDetails & { e2ePort: number } {
  const nxJson = readNxJson(tree);
  let e2ePort = portOverride ?? 4200;

  if (
    nxJson.targetDefaults?.['serve'] &&
    (nxJson.targetDefaults?.['serve'].options?.port ||
      nxJson.targetDefaults?.['serve'].options?.env?.PORT)
  ) {
    e2ePort =
      nxJson.targetDefaults?.['serve'].options?.port ||
      nxJson.targetDefaults?.['serve'].options?.env?.PORT;
  }

  const pm = getPackageManagerCommand();
  return {
    e2eCiBaseUrl: 'http://localhost:4200',
    e2eCiWebServerCommand: `${pm.exec} nx run ${projectName}:serve-static`,
    e2eWebServerCommand: `${pm.exec} nx run ${projectName}:serve`,
    e2eWebServerAddress: `http://localhost:${e2ePort}`,
    e2eDevServerTarget: 'serve',
    e2ePort,
  };
}
