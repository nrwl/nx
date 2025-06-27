import {
  Tree,
  formatFiles,
  removeDependenciesFromPackageJson,
  logger,
} from '@nx/devkit';

export default async function removeAddonDependencies(tree: Tree) {
  const dependenciesToRemove = [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ];

  removeDependenciesFromPackageJson(
    tree,
    dependenciesToRemove,
    dependenciesToRemove
  );

  logger.info(
    'Removed deprecated Storybook addon dependencies that are no longer needed in Storybook 9+'
  );

  await formatFiles(tree);
}
