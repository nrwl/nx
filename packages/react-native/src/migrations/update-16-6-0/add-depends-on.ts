import { Tree, getProjects, updateProjectConfiguration } from '@nx/devkit';

/**
 * This migration adds dependsOn to project.json.
 *
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, config] of projects.entries()) {
    if (config.targets?.['start']?.executor === '@nx/react-native:start') {
      config.targets['start'].dependsOn = [
        'ensure-symlink',
        'sync-deps',
        'pod-install',
      ];
      config.targets['run-ios'].dependsOn = [
        'ensure-symlink',
        'sync-deps',
        'pod-install',
      ];
      config.targets['bundle-ios'].dependsOn = ['ensure-symlink'];
      config.targets['run-android'].dependsOn = ['ensure-symlink', 'sync-deps'];
      config.targets['build-android'].dependsOn = [
        'ensure-symlink',
        'sync-deps',
      ];
      config.targets['build-ios'].dependsOn = [
        'ensure-symlink',
        'sync-deps',
        'pod-install',
      ];
      config.targets['pod-install'].dependsOn = ['ensure-symlink', 'sync-deps'];
      config.targets['bundle-android'].dependsOn = ['ensure-symlink'];

      updateProjectConfiguration(tree, name, config);
    }
  }
}
