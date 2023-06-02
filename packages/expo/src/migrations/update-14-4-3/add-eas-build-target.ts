import {
  Tree,
  formatFiles,
  getProjects,
  updateProjectConfiguration,
} from '@nx/devkit';
import { join } from 'path';

/**
 * Add eas build and build-list target for expo
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, config] of projects.entries()) {
    if (config.targets?.['start']?.executor === '@nrwl/expo:start') {
      if (!config.targets['build']) {
        config.targets['build'] = {
          executor: '@nrwl/expo:build',
          options: {},
        };
      }
      if (!config.targets['build-list']) {
        config.targets['build-list'] = {
          executor: '@nrwl/expo:build-list',
          options: {},
        };
      }
      if (!config.targets['download']) {
        config.targets['download'] = {
          executor: '@nrwl/expo:download',
          options: {
            output: join(config.root, 'dist'),
          },
        };
      }
    }

    updateProjectConfiguration(tree, name, config);
  }

  await formatFiles(tree);
}
