import {
  addProjectConfiguration,
  ensurePackage,
  getPackageManagerCommand,
  joinPathFragments,
  Tree,
} from '@nx/devkit';
import { Linter } from '@nx/linter';

import { nxVersion } from '../../../utils/versions';
import { NormalizedSchema } from './normalize-options';

export async function addE2e(host: Tree, options: NormalizedSchema) {
  if (options.e2eTestRunner === 'cypress') {
    const { cypressProjectGenerator } = ensurePackage<
      typeof import('@nx/cypress')
    >('@nx/cypress', nxVersion);
    return cypressProjectGenerator(host, {
      ...options,
      linter: Linter.EsLint,
      name: options.e2eProjectName,
      directory: options.directory,
      project: options.projectName,
      skipFormat: true,
    });
  } else if (options.e2eTestRunner === 'playwright') {
    const { configurationGenerator } = ensurePackage<
      typeof import('@nx/playwright')
    >('@nx/playwright', nxVersion);
    addProjectConfiguration(host, options.e2eProjectName, {
      root: options.e2eProjectRoot,
      sourceRoot: joinPathFragments(options.e2eProjectRoot, ''),
      targets: {},
      implicitDependencies: [options.projectName],
    });
    return configurationGenerator(host, {
      project: options.e2eProjectName,
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
      directory: 'src',
      js: false,
      linter: options.linter,
      setParserOptionsProject: options.setParserOptionsProject,
      webServerAddress: 'http://127.0.0.1:4200',
      webServerCommand: `${getPackageManagerCommand().exec} nx serve ${
        options.name
      }`,
    });
  }
  return () => {};
}
