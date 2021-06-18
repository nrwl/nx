import type { Tree } from '@nrwl/devkit';
import type { NormalizedSchema } from './normalized-schema';

import { cypressProjectGenerator } from '@nrwl/cypress';

import { E2eTestRunner } from '../../../utils/test-runners';

import { addProtractor } from './add-protractor';
import { removeScaffoldedE2e } from './remove-scaffolded-e2e';
import { updateE2eProject } from './update-e2e-project';

/**
 * Add E2E Config
 *
 * @param host Nx Devkit Virtual Tree
 * @param options Normalized Schema
 * @param e2eProjectRoot Raw E2E Project Root that Angular tries to write to
 *
 * @returns Function to run to add Cypres config after intial app files have been moved to correct location
 */
export async function addE2e(
  host: Tree,
  options: NormalizedSchema,
  e2eProjectRoot: string
) {
  if (options.e2eTestRunner === E2eTestRunner.Protractor) {
    await addProtractor(host, options, e2eProjectRoot);
  } else {
    removeScaffoldedE2e(host, options, e2eProjectRoot);
  }

  if (options.e2eTestRunner === 'cypress') {
    await cypressProjectGenerator(host, {
      name: options.e2eProjectName,
      directory: options.directory,
      project: options.name,
      linter: options.linter,
      skipFormat: options.skipFormat,
    });
  }

  if (options.e2eTestRunner === E2eTestRunner.Protractor) {
    updateE2eProject(host, options);
  }
}
