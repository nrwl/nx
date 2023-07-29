import {
  formatFiles,
  getProjects,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

/**
 * This function changes include field from string to array for sync-deps target
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, config] of projects.entries()) {
    if (
      config.targets?.['sync-deps']?.executor !== '@nrwl/react-native:sync-deps'
    )
      continue;
    const include = config.targets?.['sync-deps']?.options?.include;
    if (!include || !include.length) {
      continue;
    }
    config.targets['sync-deps'].options.include = include.split(',');
    updateProjectConfiguration(tree, name, config);
  }

  await formatFiles(tree);
}
