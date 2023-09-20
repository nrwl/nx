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
      if (
        config.targets?.['run-ios']?.executor === '@nx/react-native:run-ios'
      ) {
        config.targets['run-ios'].dependsOn = [
          'ensure-symlink',
          'sync-deps',
          'pod-install',
        ];
      }
      if (
        config.targets?.['bundle-ios']?.executor === '@nx/react-native:bundle'
      ) {
        config.targets['bundle-ios'].dependsOn = ['ensure-symlink'];
      }
      if (
        config.targets?.['run-android']?.executor ===
        '@nx/react-native:run-android'
      ) {
        config.targets['run-android'].dependsOn ??= [
          'ensure-symlink',
          'sync-deps',
        ];
      }
      if (
        config.targets?.['build-android']?.executor ===
        '@nx/react-native:build-android'
      ) {
        config.targets['build-android'].dependsOn = [
          'ensure-symlink',
          'sync-deps',
        ];
      }
      if (
        config.targets?.['build-ios']?.executor === '@nx/react-native:build-ios'
      ) {
        config.targets['build-ios'].dependsOn ??= [
          'ensure-symlink',
          'sync-deps',
          'pod-install',
        ];
      }
      if (
        config.targets?.['pod-instal']?.executor ===
        '@nx/react-native:pod-install'
      ) {
        config.targets['pod-install'].dependsOn ??= [
          'ensure-symlink',
          'sync-deps',
        ];
      }
      if (
        config.targets?.['bundle-android']?.executor ===
        '@nx/react-native:bundle'
      ) {
        config.targets['bundle-android'].dependsOn ??= ['ensure-symlink'];
      }

      updateProjectConfiguration(tree, name, config);
    }
  }
}
