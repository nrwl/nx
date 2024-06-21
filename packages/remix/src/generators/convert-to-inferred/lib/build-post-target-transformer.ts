import { type Tree, type TargetConfiguration } from '@nx/devkit';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import { getConfigFilePath } from './utils';
import { processTargetOutputs } from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';

export function buildPostTargetTransformer(migrationLogs: AggregatedLog) {
  return (
    target: TargetConfiguration,
    tree: Tree,
    projectDetails: { projectName: string; root: string },
    inferredTargetConfiguration: TargetConfiguration
  ) => {
    const remixConfigPath = getConfigFilePath(tree, projectDetails.root);

    if (target.options) {
      handlePropertiesFromTargetOptions(
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
        handlePropertiesFromTargetOptions(
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
      target.outputs = target.outputs.filter(
        (out) => !out.includes('options.outputPath')
      );
      processTargetOutputs(target, [], inferredTargetConfiguration, {
        projectName: projectDetails.projectName,
        projectRoot: projectDetails.root,
      });
    }

    return target;
  };
}

function handlePropertiesFromTargetOptions(
  tree: Tree,
  options: any,
  projectName: string,
  projectRoot: string,
  migrationLogs: AggregatedLog
) {
  if ('outputPath' in options) {
    migrationLogs.addLog({
      project: projectName,
      executorName: '@nx/remix:build',
      log: "Unable to migrate 'outputPath'. The Remix Config will contain the locations the build artifact will be output to.",
    });
    delete options.outputPath;
  }

  if ('includeDevDependenciesInPackageJson' in options) {
    migrationLogs.addLog({
      project: projectName,
      executorName: '@nx/remix:build',
      log: "Unable to migrate `includeDevDependenciesInPackageJson` to Remix Config. Use the `@nx/dependency-checks` ESLint rule to update your project's package.json.",
    });

    delete options.includeDevDependenciesInPackageJson;
  }

  if ('generatePackageJson' in options) {
    migrationLogs.addLog({
      project: projectName,
      executorName: '@nx/remix:build',
      log: "Unable to migrate `generatePackageJson` to Remix Config. Use the `@nx/dependency-checks` ESLint rule to update your project's package.json.",
    });

    delete options.generatePackageJson;
  }

  if ('generateLockfile' in options) {
    migrationLogs.addLog({
      project: projectName,
      executorName: '@nx/remix:build',
      log: 'Unable to migrate `generateLockfile` to Remix Config. This option is not supported.',
    });

    delete options.generateLockfile;
  }
}
