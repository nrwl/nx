import {
  formatFiles,
  generateFiles,
  readProjectConfiguration,
  readNxJson,
  type Tree,
} from '@nx/devkit';
import { join } from 'path';
import { type CypressComponentConfigurationSchema } from './schema';
import { cypressComponentConfigGenerator } from '@nx/react';

export function cypressComponentConfigurationGenerator(
  tree: Tree,
  options: CypressComponentConfigurationSchema
) {
  return cypressComponentConfigurationGeneratorInternal(tree, {
    addPlugin: false,
    ...options,
  });
}

export async function cypressComponentConfigurationGeneratorInternal(
  tree: Tree,
  options: CypressComponentConfigurationSchema
) {
  const nxJson = readNxJson(tree);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  options.addPlugin ??= addPluginDefault;
  await cypressComponentConfigGenerator(tree, {
    project: options.project,
    generateTests: options.generateTests,
    skipFormat: true,
    bundler: 'vite',
    buildTarget: '',
    addPlugin: options.addPlugin,
  });

  const project = readProjectConfiguration(tree, options.project);

  generateFiles(tree, join(__dirname, './files'), project.root, { tmpl: '' });

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default cypressComponentConfigurationGenerator;
