import { type TargetConfiguration, type Tree } from '@nx/devkit';
import { AggregatedLog } from '@nx/devkit/internal';
import { getViteConfigPath } from './utils';

export function servePostTargetTransformer(migrationLogs: AggregatedLog) {
  return (
    target: TargetConfiguration,
    tree: Tree,
    projectDetails: { projectName: string; root: string },
    inferredTargetConfiguration: TargetConfiguration
  ) => {
    getViteConfigPath(tree, projectDetails.root);

    if (target.options) {
      removePropertiesFromTargetOptions(
        target.options,
        projectDetails.root,
        projectDetails.projectName,
        migrationLogs
      );
    }

    if (target.configurations) {
      for (const configurationName in target.configurations) {
        const configuration = target.configurations[configurationName];
        removePropertiesFromTargetOptions(
          configuration,
          projectDetails.root,
          projectDetails.projectName,
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

    return target;
  };
}

function removePropertiesFromTargetOptions(
  targetOptions: any,
  projectRoot: string,
  projectName: string,
  migrationLogs: AggregatedLog
) {
  if ('buildTarget' in targetOptions) {
    delete targetOptions.buildTarget;
  }

  if ('buildLibsFromSource' in targetOptions) {
    migrationLogs.addLog({
      executorName: '@nx/vite:dev-server',
      project: projectName,
      log: `Encountered 'buildLibsFromSource' in project.json. This property will be added to your Vite config file via the '@nx/vite:build' executor migration.`,
    });
    delete targetOptions.buildLibsFromSource;
  }

  if ('hmr' in targetOptions) {
    delete targetOptions.hmr;
  }

  if ('proxyConfig' in targetOptions) {
    migrationLogs.addLog({
      executorName: '@nx/vite:dev-server',
      project: projectName,
      log: `Encountered 'proxyConfig' in project.json. You will need to copy the contents of this file to the 'server.proxy' property in your Vite config file.`,
    });
    delete targetOptions.proxyConfig;
  }
}
