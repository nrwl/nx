import { TargetConfiguration } from '@nx/devkit';
import { GradlePluginOptions } from './gradle-plugin-options';
import { isCI } from 'nx/src/devkit-internals';
import { RunCommandsOptions } from 'nx/src/executors/run-commands/run-commands.impl';

/**
 * Replace target name with options
 * if ciTargetName is provided, replace target name "ci" with ciTargetName
 * if isCI, replace target test in dependsOn with ci and exclude test in each command
 */
export function replaceTargetNameWithOptions(
  targets: Record<string, TargetConfiguration<RunCommandsOptions>>,
  options: GradlePluginOptions,
  cwd: string
): Record<string, TargetConfiguration> {
  let targetsWithReplacedName: Record<string, TargetConfiguration> = {};
  // rename target name if it is provided
  Object.entries(targets).forEach(([taskName, target]) => {
    let targetName = options?.[`${taskName}TargetName`] as string;

    // if is it CI, replace target test with ci in dependsOn and exclude test in each command
    replaceTargetDependsOnWithTestToCi(target, taskName, options, targets);
    target.options ??= {
      __unparsed__: [],
    };
    target.options.cwd = cwd;

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
  });
  return targetsWithReplacedName;
}

/**
 * This function replaces target test with ci in dependsOn and exclude test in each command if it is CI
 * It is going to change target in place
 */
function replaceTargetDependsOnWithTestToCi(
  target: TargetConfiguration,
  taskName: string,
  options: GradlePluginOptions,
  targets: Record<string, TargetConfiguration>
): void {
  if (
    isCI() &&
    options.ciTargetName &&
    targets['test'] &&
    !taskName.startsWith('ci')
  ) {
    if (target.dependsOn?.length) {
      // replace test with ci in dependsOn
      target.dependsOn = target.dependsOn.map((dep) => {
        if (typeof dep === 'string' && dep.endsWith(':test')) {
          dep = dep.replace(':test', `:${options.ciTargetName}`);
        }
        return dep;
      });
    }
    if (target.options?.args) {
      // exclude test in each command
      if (
        typeof target.options.args === 'string' &&
        !target.options.args.includes('--exclude-task test')
      ) {
        target.options.args += ' --exclude-task test';
      } else if (
        Array.isArray(target.options.args) &&
        !target.options.args.includes('--exclude-task')
      ) {
        target.options.args.push('--exclude-task', 'test');
      }
    } else {
      target.options ??= { __unparsed__: [] };
      target.options.args = ['--exclude-task', 'test'];
    }
  }
}

/**
 * Change executor to gradlew if it is batch mode
 * @param target
 * @returns target with executor changed to gradlew if it is batch mode
 */
function changeExecutorToGradlewForBatchMode(
  target: TargetConfiguration
): TargetConfiguration {
  // change executor to gradlew if it is batch mode
  if (
    process.env.NX_BATCH_MODE === 'true' &&
    target.command?.includes('gradlew')
  ) {
    target = {
      executor: '@nx/gradle:gradlew',
      options: {
        ...target,
        __unparsed__: [],
      },
      dependsOn: [...(target.dependsOn ?? [])],
      metadata: { ...target.metadata },
      inputs: target.inputs,
      outputs: target.outputs,
      cache: true,
    };
  }
  return target;
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
