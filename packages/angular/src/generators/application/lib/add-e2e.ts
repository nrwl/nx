import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import {
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { cypressProjectGenerator } from '@nrwl/cypress';
import { removeScaffoldedE2e } from './remove-scaffolded-e2e';

export async function addE2e(tree: Tree, options: NormalizedSchema) {
  removeScaffoldedE2e(tree, options, options.ngCliSchematicE2ERoot);

  if (options.e2eTestRunner === 'cypress') {
    // TODO: This can call `@nrwl/web:static-config` generator once we merge `@nrwl/angular:file-server` into `@nrwl/web:file-server`.
    addFileServerTarget(tree, options, 'serve-static');

    await cypressProjectGenerator(tree, {
      name: options.e2eProjectName,
      directory: options.directory,
      project: options.name,
      linter: options.linter,
      standaloneConfig: options.standaloneConfig,
      skipPackageJson: options.skipPackageJson,
      skipFormat: true,
    });
  }
}

function addFileServerTarget(
  tree: Tree,
  options: NormalizedSchema,
  targetName: string
) {
  const projectConfig = readProjectConfiguration(tree, options.name);
  projectConfig.targets[targetName] = {
    executor: '@nrwl/angular:file-server',
    options: {
      buildTarget: `${options.name}:build`,
      port: options.port,
    },
  };
  updateProjectConfiguration(tree, options.name, projectConfig);
}
