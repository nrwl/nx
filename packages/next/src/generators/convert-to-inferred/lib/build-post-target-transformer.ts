import { TargetConfiguration, Tree } from '@nx/devkit';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import { processTargetOutputs } from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';
import { NextBuildBuilderOptions } from '../../../utils/types';
import { updateNextConfig } from './update-next-config';

export function buildPostTargetTransformer(migrationLogs: AggregatedLog) {
  return (
    target: TargetConfiguration<NextBuildBuilderOptions>,
    tree: Tree,
    projectDetails: { projectName: string; root: string },
    inferredTargetConfiguration: TargetConfiguration
  ) => {
    if (target.options) {
      handlePropertiesFromTargetOptions(
        tree,
        target.options,
        projectDetails,
        migrationLogs
      );
    }

    if (target.configurations) {
      for (const configurationName in target.configurations) {
        const configuration = target.configurations[configurationName];
        handlePropertiesFromTargetOptions(
          tree,
          configuration,
          projectDetails,
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
  options: NextBuildBuilderOptions,
  projectDetails: { projectName: string; root: string },
  migrationLogs: AggregatedLog
) {
  const { fileReplacements, assets, outputPath } = options;

  updateNextConfig(tree, projectDetails, {
    assets,
    fileReplacements,
    outputPath,
  });

  if ('outputPath' in options) {
    delete options.outputPath;
  }
  if ('fileReplacements' in options) {
    delete options.fileReplacements;
  }
  if ('nextConfig' in options) {
    delete options.nextConfig;
  }
  if ('assets' in options) {
    delete options.assets;
  }

  if ('includeDevDependenciesInPackageJson' in options) {
    migrationLogs.addLog({
      project: projectDetails.projectName,
      executorName: '@nx/next:build',
      log: "Unable to migrate `includeDevDependenciesInPackageJson` to Next.js Config. Use the `@nx/dependency-checks` ESLint rule to update your project's package.json.",
    });

    delete options.includeDevDependenciesInPackageJson;
  }

  if ('generatePackageJson' in options) {
    migrationLogs.addLog({
      project: projectDetails.projectName,
      executorName: '@nx/next:build',
      log: "Unable to migrate `generatePackageJson` to Next.js Config. Use the `@nx/dependency-checks` ESLint rule to update your project's package.json.",
    });

    delete options.generatePackageJson;
  }

  if ('generateLockfile' in options) {
    migrationLogs.addLog({
      project: projectDetails.projectName,
      executorName: '@nx/next:build',
      log: 'Unable to migrate `generateLockfile` to Next.js Config. This option is not supported.',
    });

    delete options.generateLockfile;
  }

  if ('watch' in options) {
    // Watch is default for serve not available while running 'build'
    delete options.watch;
  }

  if ('experimentalAppOnly' in options && options['experimentalAppOnly']) {
    options['args'] ??= [];
    options['args'].push('--experimental-app-only');
    delete options.experimentalAppOnly;
  }

  if ('experimentalBuildMode' in options) {
    options['args'] ??= [];
    options['args'].push('--experimental-build-mode');
    delete options.experimentalBuildMode;
  }
}
