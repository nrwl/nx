import {
  formatFiles,
  getProjects,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

/**
 * This function changes searchDir field from string to array for storybook target
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, config] of projects.entries()) {
    if (
      config.targets?.['storybook']?.executor !== '@nrwl/react-native:storybook'
    )
      continue;
    const searchDir = config.targets?.['storybook']?.options?.searchDir;
    if (!searchDir || !searchDir.length || Array.isArray(searchDir)) {
      continue;
    }
    config.targets['storybook'].options.searchDir = searchDir.split(',');
    updateProjectConfiguration(tree, name, config);
  }

  await formatFiles(tree);
}
