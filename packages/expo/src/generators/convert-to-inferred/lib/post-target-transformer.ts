import type { TargetConfiguration, Tree } from '@nx/devkit';
import type { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import { processTargetOutputs } from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';

export function postTargetTransformer(
  migrationLogs: AggregatedLog,
  processOptions: (
    tree: Tree,
    options: any,
    projectName: string,
    projectRoot: string,
    migrationLogs: AggregatedLog
  ) => void
) {
  return (
    target: TargetConfiguration,
    tree: Tree,
    projectDetails: { projectName: string; root: string },
    inferredTargetConfiguration: TargetConfiguration
  ) => {
    if (target.options) {
      processOptions(
        tree,
        target.options,
        projectDetails.projectName,
        projectDetails.root,
        migrationLogs
      );
    }

    if (target.configurations) {
      for (const configurationName in target.configurations) {
        const configuration = target.configurations[configurationName];
        processOptions(
          tree,
          configuration,
          projectDetails.projectName,
          projectDetails.root,
          migrationLogs
        );
      }

      if (Object.keys(target.configurations).length === 0) {
        if ('defaultConfiguration' in target) {
          delete target.defaultConfiguration;
        }
        delete target.configurations;
      }

      if (
        'defaultConfiguration' in target &&
        !target.configurations[target.defaultConfiguration]
      ) {
        delete target.defaultConfiguration;
      }
    }

    if (target.outputs) {
      processTargetOutputs(target, [], inferredTargetConfiguration, {
        projectName: projectDetails.projectName,
        projectRoot: projectDetails.root,
      });
    }

    return target;
  };
}
