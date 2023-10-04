import {
  Tree,
  formatFiles,
  getProjects,
  updateProjectConfiguration,
} from '@nx/devkit';

/**
 * Add eject to targets for expo app
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, config] of projects.entries()) {
    if (config.targets?.['start']?.executor === '@nrwl/expo:start') {
      config.targets['eject'] = {
        executor: '@nrwl/expo:eject',
        options: {},
      };
    }

    updateProjectConfiguration(tree, name, config);
  }

  await formatFiles(tree);
}
