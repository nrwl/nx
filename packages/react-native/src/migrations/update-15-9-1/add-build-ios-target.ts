import {
  Tree,
  formatFiles,
  getProjects,
  updateProjectConfiguration,
} from '@nx/devkit';

/**
 * Add build-ios target for react-native
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, config] of projects.entries()) {
    if (config.targets?.['start']?.executor === '@nx/react-native:start') {
      if (!config.targets['build-ios']) {
        config.targets['build-ios'] = {
          executor: '@nx/react-native:build-ios',
          outputs: ['{projectRoot}/ios/build/Build'],
          options: {},
        };
      }
      if (!config.targets['pod-install']) {
        config.targets['pod-install'] = {
          executor: '@nx/react-native:pod-install',
          options: {},
        };
      }
    }

    updateProjectConfiguration(tree, name, config);
  }

  await formatFiles(tree);
}
