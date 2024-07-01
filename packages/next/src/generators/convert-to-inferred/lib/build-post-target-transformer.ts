import { TargetConfiguration, Tree } from '@nx/devkit';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import {
  processTargetOutputs,
  toProjectRelativePath,
} from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';
import { NextBuildBuilderOptions } from '../../../utils/types';
import { updateNextConfig } from './update-next-config';

export function buildPostTargetTransformer(migrationLogs: AggregatedLog) {
  return (
    target: TargetConfiguration<NextBuildBuilderOptions>,
    tree: Tree,
    projectDetails: { projectName: string; root: string },
    inferredTargetConfiguration: TargetConfiguration
  ) => {
    const configValues = {};
    if (target.options) {
      handlePropertiesFromTargetOptions(
        target.options,
        projectDetails,
        migrationLogs,
        'default',
        configValues
      );
    }

    if (target.configurations) {
      for (const configurationName in target.configurations) {
        const configuration = target.configurations[configurationName];
        handlePropertiesFromTargetOptions(
          configuration,
          projectDetails,
          migrationLogs,
          configurationName,
          configValues
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
    const partialNextConfig = `
    
    const configValues = ${JSON.stringify(configValues, null, 2)};

    const configuration = process.env.NX_TASK_TARGET_CONFIGURATION || 'default';

    const options = {
      ...configValues.default,
      // @ts-expect-error: Ignore TypeScript error for indexing configValues with a dynamic key
      ...configValues[configuration],
    };
    `;
    updateNextConfig(tree, partialNextConfig, projectDetails, migrationLogs);
    return target;
  };
}

function handlePropertiesFromTargetOptions(
  options: NextBuildBuilderOptions,
  projectDetails: { projectName: string; root: string },
  migrationLogs: AggregatedLog,
  configuration: string = 'default',
  configValues: any
) {
  let configMap = configValues[configuration] ?? {};

  if ('outputPath' in options) {
    migrationLogs.addLog({
      project: projectDetails.projectName,
      executorName: '@nx/next:build',
      log: 'Unable to migrate `outputPath` to Next.js config as it may lead to unexpected behavior. Please use the `distDir` option in your next.config.js file instead.',
    });
    delete options.outputPath;
  }
  if ('fileReplacements' in options) {
    configMap['fileReplacements'] = options.fileReplacements.map(
      ({ replace: replacePath, with: withPath }) => {
        return {
          replace: toProjectRelativePath(replacePath, projectDetails.root),
          with: toProjectRelativePath(withPath, projectDetails.root),
        };
      }
    );

    delete options.fileReplacements;
  }
  if ('nextConfig' in options) {
    delete options.nextConfig;
  }
  if ('assets' in options) {
    configMap['assets'] = options.assets.map((asset) => {
      return {
        ...asset,
        input: toProjectRelativePath(asset.input, projectDetails.root),
        output: toProjectRelativePath(asset.output, projectDetails.root),
      };
    });

    delete options.assets;
  }

  if ('includeDevDependenciesInPackageJson' in options) {
    migrationLogs.addLog({
      project: projectDetails.projectName,
      executorName: '@nx/next:build',
      log: "Unable to migrate `includeDevDependenciesInPackageJson` to Next.js config. Use the `@nx/dependency-checks` ESLint rule to update your project's package.json.",
    });

    delete options.includeDevDependenciesInPackageJson;
  }

  if ('generatePackageJson' in options) {
    migrationLogs.addLog({
      project: projectDetails.projectName,
      executorName: '@nx/next:build',
      log: "Unable to migrate `generatePackageJson` to Next.js config. Use the `@nx/dependency-checks` ESLint rule to update your project's package.json.",
    });

    delete options.generatePackageJson;
  }

  if ('generateLockfile' in options) {
    migrationLogs.addLog({
      project: projectDetails.projectName,
      executorName: '@nx/next:build',
      log: 'Unable to migrate `generateLockfile` to Next.js config. This option is not supported.',
    });

    delete options.generateLockfile;
  }

  if ('watch' in options) {
    // Watch is default for serve not available while running 'build'
    delete options.watch;
  }

  if ('debug' in options) {
    if (options.debug) {
      options['args'] ??= [];
      options['args'].push('--debug');
    }
    delete options.debug;
  }

  if ('profile' in options) {
    if (options.profile) {
      options['args'] ??= [];
      options['args'].push('--profile');
    }
    delete options.profile;
  }

  if ('experimentalAppOnly' in options) {
    if (options.experimentalAppOnly) {
      options['args'] ??= [];
      options['args'].push('--experimental-app-only');
    }
    delete options.experimentalAppOnly;
  }

  if ('experimentalBuildMode' in options) {
    options['args'] ??= [];
    options['args'].push(
      `--experimental-build-mode ${options.experimentalBuildMode}`
    );
    delete options.experimentalBuildMode;
  }
  configValues[configuration] = configMap;
}
