import { TargetConfiguration } from '@nx/devkit';
import { GradlePluginOptions } from './gradle-plugin-options';
import { isCI } from 'nx/src/devkit-internals';

/**
 * Replace target name with options
 * if ciTargetName is provided, replace target name "ci" with ciTargetName
 * if isCI, replace target test in dependsOn with ci
 */
export function replaceTargetNameWithOptions(
  targets: Record<string, TargetConfiguration>,
  options: GradlePluginOptions
): Record<string, TargetConfiguration> {
  let targetsWithReplacedName: Record<string, TargetConfiguration> = {};
  // rename target name if it is provided
  Object.entries(targets).forEach(([taskName, target]) => {
    let targetName = options?.[`${taskName}TargetName`] as string;
    if (taskName.startsWith('ci')) {
      if (options.ciTargetName) {
        targetName = taskName.replace('ci', options.ciTargetName);
        targetsWithReplacedName[targetName] = target;
        if (targetName === options.ciTargetName) {
          target.metadata.nonAtomizedTarget = options.testTargetName;
          target.dependsOn.forEach((dep) => {
            if (typeof dep !== 'string' && dep.target.startsWith('ci')) {
              dep.target = dep.target.replace('ci', options.ciTargetName);
            }
          });
        }
      }
    } else if (targetName) {
      targetsWithReplacedName[targetName] = target;
    } else {
      targetsWithReplacedName[taskName] = target;
    }
    // if is it CI, replace target test with ci
    if (isCI() && target.dependsOn?.length) {
      target.dependsOn = target.dependsOn.map((dep) => {
        if (typeof dep === 'string' && dep.endsWith(':test')) {
          dep = dep.replace(':test', `:${options.ciTargetName}`);
        }
        return dep;
      });
    }
  });
  return targetsWithReplacedName;
}

/**
 * rename target names in target groups if it is provided
 */
export function replaceTargeGroupNameWithOptions(
  targetGroups: Record<string, string[]>,
  options: GradlePluginOptions
): Record<string, string[]> {
  Object.entries(targetGroups).forEach(([groupName, group]) => {
    const targetGroup = group
      .map((taskName) => {
        let targetName = options?.[`${taskName}TargetName`] as string;
        if (targetName) {
          return targetName;
        } else if (options.ciTargetName && taskName.startsWith('ci')) {
          targetName = taskName.replace('ci', options.ciTargetName);
          return targetName;
        } else {
          return taskName;
        }
      })
      .filter(Boolean);
    targetGroups[groupName] = targetGroup;
  });
  return targetGroups;
}
