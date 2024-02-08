import { configurationGenerator } from '@nx/cypress';
import type { Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  ensurePackage,
  getPackageManagerCommand,
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import { nxVersion } from '../../../utils/versions';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { NormalizedSchema } from './normalized-schema';

export async function addE2e(tree: Tree, options: NormalizedSchema) {
  if (options.e2eTestRunner === 'cypress') {
    // TODO: This can call `@nx/web:static-config` generator when ready
    addFileServerTarget(tree, options, 'serve-static');
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
      devServerTarget: `${options.name}:serve:development`,
      baseUrl: 'http://localhost:4200',
      rootProject: options.rootProject,
      addPlugin: options.addPlugin,
    });
  } else if (options.e2eTestRunner === 'playwright') {
    const { configurationGenerator: playwrightConfigurationGenerator } =
      ensurePackage<typeof import('@nx/playwright')>(
        '@nx/playwright',
        nxVersion
      );
    addProjectConfiguration(tree, options.e2eProjectName, {
      projectType: 'application',
      root: options.e2eProjectRoot,
      sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
      targets: {},
      implicitDependencies: [options.name],
    });
    await playwrightConfigurationGenerator(tree, {
      project: options.e2eProjectName,
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
      directory: 'src',
      js: false,
      linter: options.linter,
      setParserOptionsProject: options.setParserOptionsProject,
      webServerCommand: `${getPackageManagerCommand().exec} nx serve ${
        options.name
      }`,
      webServerAddress: `http://localhost:${options.port ?? 4200}`,
      rootProject: options.rootProject,
      addPlugin: options.addPlugin,
    });
  }
}

function addFileServerTarget(
  tree: Tree,
  options: NormalizedSchema,
  targetName: string
) {
  addDependenciesToPackageJson(tree, {}, { '@nx/web': nxVersion });

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  const isUsingApplicationBuilder =
    angularMajorVersion >= 17 && options.bundler === 'esbuild';

  const projectConfig = readProjectConfiguration(tree, options.name);
  projectConfig.targets[targetName] = {
    executor: '@nx/web:file-server',
    options: {
      buildTarget: `${options.name}:build`,
      port: options.port,
      staticFilePath: isUsingApplicationBuilder
        ? joinPathFragments(options.outputPath, 'browser')
        : undefined,
    },
  };
  updateProjectConfiguration(tree, options.name, projectConfig);
}
