import { type TargetConfiguration, type Tree } from '@nx/devkit';
import { getViteConfigPath } from './utils';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';

export function previewPostTargetTransformer(migrationLogs: AggregatedLog) {
  return (
    target: TargetConfiguration,
    tree: Tree,
    projectDetails: { projectName: string; root: string },
    inferredTargetConfiguration: TargetConfiguration
  ) => {
    const viteConfigPath = getViteConfigPath(tree, projectDetails.root);

    if (target.options) {
      removePropertiesFromTargetOptions(
        target.options,
        projectDetails.projectName,
        migrationLogs
      );
    }

    if (target.configurations) {
      for (const configurationName in target.configurations) {
        const configuration = target.configurations[configurationName];
        removePropertiesFromTargetOptions(
          configuration,
          projectDetails.projectName,
          migrationLogs
        );

        if (Object.keys(configuration).length === 0) {
          delete target.configurations[configurationName];
        }
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

    return target;
  };
}

function removePropertiesFromTargetOptions(
  targetOptions: any,
  projectName: string,
  migrationLogs: AggregatedLog
) {
  if ('buildTarget' in targetOptions) {
    delete targetOptions.buildTarget;
  }

  if ('staticFilePath' in targetOptions) {
    delete targetOptions.staticFilePath;
  }

  if ('proxyConfig' in targetOptions) {
    migrationLogs.addLog({
      executorName: '@nx/vite:preview-server',
      project: projectName,
      log: `Encountered 'proxyConfig' in project.json. You will need to copy the contents of this file to the 'server.proxy' property in your Vite config file.`,
    });
    delete targetOptions.proxyConfig;
  }
}
