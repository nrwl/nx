import {
  TargetConfiguration,
  Tree,
  getProjects,
  updateProjectConfiguration,
} from '@nx/devkit';
import { rmSync } from 'node:fs';

/**
 * Remove ensure-symlink target.
 * It is going to be supported by react-native version 0.73 by default.
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [projectName, config] of projects.entries()) {
    if (
      config.targets?.['ensure-symlink']?.executor ===
      '@nx/react-native:ensure-symlink'
    ) {
      removeTargets(config.targets, 'ensure-symlink');
      updateProjectConfiguration(tree, projectName, config);
      rmSync(`${config.root}/node_modules`, { recursive: true, force: true });
    }
  }
}

function removeTargets(
  targets: {
    [targetName: string]: TargetConfiguration<any>;
  },
  targetNameToRemove: string
) {
  for (const targetName in targets) {
    if (targetName === targetNameToRemove) {
      delete targets[targetName];
    }
    if (targets[targetName]?.dependsOn?.length) {
      targets[targetName].dependsOn = targets[targetName].dependsOn.filter(
        (dependsOn) => dependsOn !== targetNameToRemove
      );
    }
  }
}
