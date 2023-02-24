import {
  Tree,
  formatFiles,
  getProjects,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { join } from 'path';

/**
 * Add build-ios target for react-native
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, config] of projects.entries()) {
    if (config.targets?.['start']?.executor === '@nrwl/react-native:start') {
      if (!config.targets['build-ios']) {
        config.targets['build-ios'] = {
          executor: '@nrwl/react-native:build-ios',
          options: {},
        };
      }
    }

    updateProjectConfiguration(tree, name, config);
  }

  await formatFiles(tree);
}
