import { Tree, getProjects, updateProjectConfiguration } from '@nx/devkit';

/**
 * This migration adds dependsOn to project.json.
 *
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, config] of projects.entries()) {
    if (config.targets?.['start']?.executor === '@nx/expo:start') {
      config.targets['start'].dependsOn = ['ensure-symlink', 'sync-deps'];
    }
    if (config.targets?.['run-ios']?.executor === '@nx/expo:run') {
      config.targets['run-ios'].dependsOn = ['ensure-symlink', 'sync-deps'];
    }
    if (config.targets?.['run-android']?.executor === '@nx/expo:run') {
      config.targets['run-android'].dependsOn = ['ensure-symlink', 'sync-deps'];
    }
    if (config.targets?.['prebuild']?.executor === '@nx/expo:prebuild') {
      config.targets['prebuild'].dependsOn = ['ensure-symlink', 'sync-deps'];
    }
    if (config.targets?.['export']?.executor === '@nx/expo:export') {
      config.targets['export'].dependsOn = ['ensure-symlink', 'sync-deps'];
    }

    updateProjectConfiguration(tree, name, config);
  }
}
