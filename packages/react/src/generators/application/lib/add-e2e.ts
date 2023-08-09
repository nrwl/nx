import type { GeneratorCallback, Tree } from '@nx/devkit';
import {
  addProjectConfiguration,
  ensurePackage,
  getPackageManagerCommand,
  joinPathFragments,
  readProjectConfiguration,
} from '@nx/devkit';
import { webStaticServeGenerator } from '@nx/web';

import { nxVersion } from '../../../utils/versions';
import { NormalizedSchema } from '../schema';

export async function addE2e(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  switch (options.e2eTestRunner) {
    case 'cypress':
      webStaticServeGenerator(tree, {
        buildTarget: `${options.projectName}:build`,
        targetName: 'serve-static',
      });

      const { cypressProjectGenerator } = ensurePackage<
        typeof import('@nx/cypress')
      >('@nx/cypress', nxVersion);

      return await cypressProjectGenerator(tree, {
        ...options,
        name: options.e2eProjectName,
        directory: options.directory,
        project: options.projectName,
        bundler: options.bundler === 'rspack' ? 'webpack' : options.bundler,
        skipFormat: true,
      });
    case 'playwright':
      const { configurationGenerator } = ensurePackage<
        typeof import('@nx/playwright')
      >('@nx/playwright', nxVersion);
      addProjectConfiguration(tree, options.e2eProjectName, {
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
    case 'none':
    default:
      return () => {};
  }
}
