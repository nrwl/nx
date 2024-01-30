import {
  formatFiles,
  generateFiles,
  readProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { join } from 'path';
import { type CypressComponentConfigurationSchema } from './schema';
import { cypressComponentConfigGenerator } from '@nx/react';

export default async function cypressComponentConfigurationGenerator(
  tree: Tree,
  options: CypressComponentConfigurationSchema
) {
  await cypressComponentConfigGenerator(tree, {
    project: options.project,
    generateTests: options.generateTests,
    skipFormat: true,
    bundler: 'vite',
    buildTarget: '',
  });

  const project = readProjectConfiguration(tree, options.project);

  generateFiles(tree, join(__dirname, './files'), project.root, { tmpl: '' });

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}
