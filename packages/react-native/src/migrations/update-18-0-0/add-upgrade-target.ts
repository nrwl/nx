import {
  Tree,
  formatFiles,
  getProjects,
  updateProjectConfiguration,
  workspaceRoot,
} from '@nx/devkit';

import { runCliUpgrade } from '../../executors/upgrade/upgrade.impl';

/**
 * Add target upgrade for react native apps
 * Remove pod-install from dependsOn for all targets, it does pod-install when creating the app
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, config] of projects.entries()) {
    if (config.targets?.['start']?.executor === '@nx/react-native:start') {
      if (!config.targets['upgrade']) {
        config.targets.upgrade = {
          executor: '@nx/react-native:upgrade',
          options: {},
        };
      }
      if (
        config.targets?.['pod-install']?.executor ===
        '@nx/react-native:pod-install'
      ) {
        for (const targetName in config.targets) {
          if (config.targets[targetName]?.dependsOn?.length) {
            config.targets[targetName].dependsOn = config.targets[
              targetName
            ].dependsOn.filter((dependsOn) => dependsOn !== 'pod-install');
          }
        }
      }
      updateProjectConfiguration(tree, name, config);
    }
  }

  await formatFiles(tree);
}
