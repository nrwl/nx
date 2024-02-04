import {
  addProjectConfiguration,
  ensurePackage,
  getPackageManagerCommand,
  joinPathFragments,
  readNxJson,
  Tree,
} from '@nx/devkit';
import { Linter } from '@nx/eslint';

import { nxVersion } from '../../../utils/versions';
import { NormalizedSchema } from './normalize-options';

export async function addE2e(host: Tree, options: NormalizedSchema) {
  const nxJson = readNxJson(host);
  const hasPlugin = nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/next/plugin'
      : p.plugin === '@nx/next/plugin'
  );
  if (options.e2eTestRunner === 'cypress') {
    const { configurationGenerator } = ensurePackage<
      typeof import('@nx/cypress')
    >('@nx/cypress', nxVersion);
    addProjectConfiguration(host, options.e2eProjectName, {
      root: options.e2eProjectRoot,
      sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
      targets: {},
      tags: [],
      implicitDependencies: [options.projectName],
    });
    return configurationGenerator(host, {
      ...options,
      linter: Linter.EsLint,
      project: options.e2eProjectName,
      directory: 'src',
      skipFormat: true,
      devServerTarget: `${options.projectName}:${
        hasPlugin ? 'start' : 'serve'
      }`,
      baseUrl: `http://localhost:${hasPlugin ? '3000' : '4200'}`,
      jsx: true,
    });
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
    return configurationGenerator(host, {
      rootProject: options.rootProject,
      project: options.e2eProjectName,
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
      directory: 'src',
      js: false,
      linter: options.linter,
      setParserOptionsProject: options.setParserOptionsProject,
      webServerAddress: `http://127.0.0.1:${hasPlugin ? '3000' : '4200'}`,
      webServerCommand: `${getPackageManagerCommand().exec} nx ${
        hasPlugin ? 'start' : 'serve'
      } ${options.projectName}`,
      addPlugin: options.addPlugin,
    });
  }
  return () => {};
}
