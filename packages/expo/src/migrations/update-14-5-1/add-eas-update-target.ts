import {
  Tree,
  formatFiles,
  getProjects,
  updateProjectConfiguration,
} from '@nx/devkit';

/**
 * Add eas update target for expo
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, config] of projects.entries()) {
    if (config.targets?.['start']?.executor === '@nrwl/expo:start') {
      if (!config.targets['update']) {
        config.targets['update'] = {
          executor: '@nrwl/expo:update',
          options: {},
        };
      }
      updateProjectConfiguration(tree, name, config);
    }
  }

  await formatFiles(tree);
}
