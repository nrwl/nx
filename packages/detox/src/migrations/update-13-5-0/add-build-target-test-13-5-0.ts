import {
  Tree,
  formatFiles,
  getProjects,
  updateProjectConfiguration,
} from '@nrwl/devkit';

/**
 * This function buildTarget to test-ios and test-android
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, config] of projects.entries()) {
    if (config.targets?.['test-ios']?.executor === '@nrwl/detox:test') {
      config.targets['test-ios'].options.buildTarget = `${name}:build-ios`;
      config.targets[
        'test-ios'
      ].configurations.production.buildTarget = `${name}:build-ios:prod`;
    }

    if (config.targets?.['test-android']?.executor === '@nrwl/detox:test') {
      config.targets[
        'test-android'
      ].options.buildTarget = `${name}:build-android`;
      config.targets[
        'test-android'
      ].configurations.production.buildTarget = `${name}:build-android:prod`;
    }

    updateProjectConfiguration(tree, name, config);
  }

  await formatFiles(tree);
}
