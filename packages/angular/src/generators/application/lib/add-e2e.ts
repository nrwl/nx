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
import type { NormalizedSchema } from './normalized-schema';
import { cypressProjectGenerator } from '@nx/cypress';

export async function addE2e(tree: Tree, options: NormalizedSchema) {
  if (options.e2eTestRunner === 'cypress') {
    // TODO: This can call `@nx/web:static-config` generator when ready
    addFileServerTarget(tree, options, 'serve-static');

    await cypressProjectGenerator(tree, {
      name: options.e2eProjectName,
      directory: options.e2eProjectRoot,
      // the name and root are already normalized, instruct the generator to use them as is
      projectNameAndRootFormat: 'as-provided',
      project: options.name,
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
      skipPackageJson: options.skipPackageJson,
      skipFormat: true,
    });
  } else if (options.e2eTestRunner === 'playwright') {
    const { configurationGenerator: playwrightConfigurationGenerator } =
      ensurePackage<typeof import('@nx/playwright')>(
        '@nx/playwright',
        nxVersion
      );
    addProjectConfiguration(tree, options.e2eProjectName, {
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
    });
  }
}

function addFileServerTarget(
  tree: Tree,
  options: NormalizedSchema,
  targetName: string
) {
  addDependenciesToPackageJson(tree, {}, { '@nx/web': nxVersion });

  const projectConfig = readProjectConfiguration(tree, options.name);
  projectConfig.targets[targetName] = {
    executor: '@nx/web:file-server',
    options: {
      buildTarget: `${options.name}:build`,
      port: options.port,
    },
  };
  updateProjectConfiguration(tree, options.name, projectConfig);
}
