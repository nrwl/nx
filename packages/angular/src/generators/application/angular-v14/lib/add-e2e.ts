import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import { cypressProjectGenerator } from '@nrwl/cypress';
import { removeScaffoldedE2e } from './remove-scaffolded-e2e';

export async function addE2e(tree: Tree, options: NormalizedSchema) {
  removeScaffoldedE2e(tree, options, options.ngCliSchematicE2ERoot);

  if (options.e2eTestRunner === 'cypress') {
    await cypressProjectGenerator(tree, {
      name: options.e2eProjectName,
      directory: options.directory,
      project: options.name,
      linter: options.linter,
      skipFormat: options.skipFormat,
      standaloneConfig: options.standaloneConfig,
      skipPackageJson: options.skipPackageJson,
      rootProject: options.rootProject,
    });
  }
}
