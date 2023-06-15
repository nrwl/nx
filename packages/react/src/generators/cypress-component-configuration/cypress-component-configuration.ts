import {
  ensurePackage,
  formatFiles,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';
import { addFiles } from './lib/add-files';
import { addCTTargetWithBuildTarget } from '../../utils/ct-utils';
import { CypressComponentConfigurationSchema } from './schema.d';

/**
 * This is for using cypresses own Component testing, if you want to use test
 * storybook components then use componentCypressGenerator instead.
 *
 */
export async function cypressComponentConfigGenerator(
  tree: Tree,
  options: CypressComponentConfigurationSchema
) {
  const { cypressComponentConfiguration: baseCyCtConfig } = ensurePackage<
    typeof import('@nx/cypress')
  >('@nx/cypress', nxVersion);
  const projectConfig = readProjectConfiguration(tree, options.project);
  const installTask = await baseCyCtConfig(tree, {
    project: options.project,
    skipFormat: true,
  });

  const found = await addCTTargetWithBuildTarget(tree, {
    project: options.project,
    buildTarget: options.buildTarget,
    validExecutorNames: new Set<string>([
      '@nx/webpack:webpack',
      '@nx/vite:build',
      '@nrwl/webpack:webpack',
      '@nrwl/vite:build',
    ]),
  });

  await addFiles(tree, projectConfig, options, found);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return () => {
    installTask();
  };
}

export default cypressComponentConfigGenerator;
