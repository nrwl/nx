import {
  Tree,
  formatFiles,
  getProjects,
  updateProjectConfiguration,
} from '@nx/devkit';

/**
 * Add new submit target
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, config] of projects.entries()) {
    if (config.targets?.['start']?.executor === '@nx/expo:start') {
      if (!config.targets['submit']) {
        config.targets['submit'] = {
          executor: '@nx/expo:submit',
          options: {},
        };
        updateProjectConfiguration(tree, name, config);
      }
    }
  }

  await formatFiles(tree);
}
