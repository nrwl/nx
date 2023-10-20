import type { GeneratorCallback, Tree } from '@nx/devkit';
import {
  addProjectConfiguration,
  ensurePackage,
  getPackageManagerCommand,
  joinPathFragments,
} from '@nx/devkit';
import { webStaticServeGenerator } from '@nx/web';

import { nxVersion } from '../../../utils/versions';
import { NormalizedSchema } from '../schema';

export async function addE2e(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  switch (options.e2eTestRunner) {
    case 'cypress': {
      webStaticServeGenerator(tree, {
        buildTarget: `${options.projectName}:build`,
        targetName: 'serve-static',
      });

      const { configurationGenerator } = ensurePackage<
        typeof import('@nx/cypress')
      >('@nx/cypress', nxVersion);
      addProjectConfiguration(tree, options.e2eProjectName, {
        projectType: 'application',
        root: options.e2eProjectRoot,
        sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
        targets: {},
        tags: [],
        implicitDependencies: [options.projectName],
      });
      return await configurationGenerator(tree, {
        ...options,
        project: options.e2eProjectName,
        directory: 'src',
        bundler: 'vite',
        skipFormat: true,
        devServerTarget: `${options.projectName}:serve`,
        jsx: true,
      });
    }
    case 'playwright': {
      const { configurationGenerator } = ensurePackage<
        typeof import('@nx/playwright')
      >('@nx/playwright', nxVersion);
      addProjectConfiguration(tree, options.e2eProjectName, {
        projectType: 'application',
        root: options.e2eProjectRoot,
        sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
        targets: {},
        implicitDependencies: [options.projectName],
      });
      return configurationGenerator(tree, {
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
        webServerAddress: 'http://localhost:4200',
      });
    }
    case 'none':
    default:
      return () => {};
  }
}
