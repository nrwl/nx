import {
  ensurePackage,
  formatFiles,
  readNxJson,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';
import { addFiles } from './lib/add-files';
import { configureCypressCT } from '../../utils/ct-utils';
import { CypressComponentConfigurationSchema } from './schema.d';

export function cypressComponentConfigGenerator(
  tree: Tree,
  options: CypressComponentConfigurationSchema
) {
  return cypressComponentConfigGeneratorInternal(tree, {
    addPlugin: false,
    ...options,
  });
}

/**
 * This is for using cypresses own Component testing, if you want to use test
 * storybook components then use componentCypressGenerator instead.
 *
 */
export async function cypressComponentConfigGeneratorInternal(
  tree: Tree,
  options: CypressComponentConfigurationSchema
) {
  const { componentConfigurationGenerator: baseCyCtConfig } = ensurePackage<
    typeof import('@nx/cypress')
  >('@nx/cypress', nxVersion);

  const nxJson = readNxJson(tree);
  const addPlugin =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  options.addPlugin ??= addPlugin;

  const projectConfig = readProjectConfiguration(tree, options.project);
  const installTask = await baseCyCtConfig(tree, {
    project: options.project,
    skipFormat: true,
    jsx: true,
    addPlugin: options.addPlugin,
  });

  const found = await configureCypressCT(tree, {
    project: options.project,
    buildTarget: options.buildTarget,
    bundler: options.bundler,
    validExecutorNames: new Set<string>([
      '@nx/webpack:webpack',
      '@nx/vite:build',
    ]),
  });

  await addFiles(tree, projectConfig, options, found);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

export default cypressComponentConfigGenerator;
