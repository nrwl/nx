import type { TargetConfiguration, Tree } from '@nx/devkit';
import type { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import { processTargetOutputs } from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';

export function postTargetTransformer(
  migrationLogs: AggregatedLog,
  processOptions?: (
    projectName: string,
    options: any,
    migrationLogs: AggregatedLog
  ) => void
) {
  return (
    target: TargetConfiguration,
    _tree: Tree,
    projectDetails: { projectName: string; root: string },
    inferredTargetConfiguration: TargetConfiguration
  ) => {
    if (target.options && processOptions) {
      processOptions(projectDetails.projectName, target.options, migrationLogs);
    }

    if (target.configurations && processOptions) {
      for (const configurationName in target.configurations) {
        const configuration = target.configurations[configurationName];
        processOptions(
          projectDetails.projectName,
          configuration,
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
