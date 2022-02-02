import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import { cypressProjectGenerator } from '@nrwl/cypress';

import { E2eTestRunner } from '../../../utils/test-runners';

import { addProtractor } from './add-protractor';
import { removeScaffoldedE2e } from './remove-scaffolded-e2e';
import { updateE2eProject } from './update-e2e-project';
import { convertToNxProjectGenerator } from '@nrwl/workspace';
import { Linter, lintProjectGenerator } from '@nrwl/linter';
import { getWorkspaceLayout, joinPathFragments } from '@nrwl/devkit';

/**
 * Add E2E Config
 *
 * @param tree Nx Devkit Virtual Tree
 * @param options Normalized Schema
 * @param e2eProjectRoot Raw E2E Project Root that Angular tries to write to
 *
 * @returns Function to run to add Cypres config after intial app files have been moved to correct location
 */
export async function addE2e(
  tree: Tree,
  options: NormalizedSchema,
  e2eProjectRoot: string
) {
  if (options.e2eTestRunner === E2eTestRunner.Protractor) {
    await addProtractor(tree, options);
  } else {
    removeScaffoldedE2e(tree, options, e2eProjectRoot);
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
