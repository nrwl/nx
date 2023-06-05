import {
  Tree,
  formatFiles,
  getProjects,
  updateProjectConfiguration,
} from '@nx/devkit';

/**
 * Remove deprecated @expo/cli targets
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, config] of projects.entries()) {
    if (
      config.targets?.['start']?.executor === '@nrwl/expo:start' ||
      config.targets?.['start']?.executor === '@nx/expo:start'
    ) {
      const targetsToDelete = [
        'build-ios',
        'build-android',
        'build-web',
        'build-status',
        'publish',
        'publish-set',
        'rollback',
        'eject',
      ];
      targetsToDelete.forEach((target) => {
        if (config.targets[target]) {
          delete config.targets[target];
        }
      });
      updateProjectConfiguration(tree, name, config);
    }
  }

  await formatFiles(tree);
}
