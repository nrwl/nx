import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import { cypressProjectGenerator } from '@nrwl/cypress';

import { E2eTestRunner } from '../../../utils/test-runners';

import { addProtractor } from './add-protractor';
import { removeScaffoldedE2e } from './remove-scaffolded-e2e';
import { updateE2eProject } from './update-e2e-project';
import { convertToNxProjectGenerator } from '@nrwl/workspace/generators';
import { Linter, lintProjectGenerator } from '@nrwl/linter';
import { getWorkspaceLayout, joinPathFragments } from '@nrwl/devkit';

export async function addE2e(tree: Tree, options: NormalizedSchema) {
  if (options.e2eTestRunner === E2eTestRunner.Protractor) {
    await addProtractor(tree, options);
  } else {
    removeScaffoldedE2e(tree, options, options.ngCliSchematicE2ERoot);
  }

  if (options.e2eTestRunner === 'cypress') {
    await cypressProjectGenerator(tree, {
      name: options.e2eProjectName,
      directory: options.directory,
      project: options.name,
      linter: options.linter,
      skipFormat: options.skipFormat,
      standaloneConfig: options.standaloneConfig,
      skipPackageJson: options.skipPackageJson,
    });
  }

  if (options.e2eTestRunner === E2eTestRunner.Protractor) {
    updateE2eProject(tree, options);
    if (
      options.standaloneConfig ??
      getWorkspaceLayout(tree).standaloneAsDefault
    ) {
      await convertToNxProjectGenerator(tree, {
        project: `${options.e2eProjectName}`,
      });
    }
    if (options.linter === Linter.EsLint) {
      await lintProjectGenerator(tree, {
        project: options.e2eProjectName,
        linter: options.linter,
        eslintFilePatterns: [
          joinPathFragments(options.e2eProjectRoot, '**/*.ts'),
        ],
        skipFormat: true,
        setParserOptionsProject: options.setParserOptionsProject,
        skipPackageJson: options.skipPackageJson,
      });
    }
  }
}
