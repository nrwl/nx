import { TargetConfiguration, Tree } from '@nx/devkit';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import type { NextServeBuilderOptions } from '../../../utils/types';
import type { InferredTargetConfiguration } from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';

export function servePosTargetTransformer(migrationLogs: AggregatedLog) {
  return (
    target: TargetConfiguration<NextServeBuilderOptions>,
    _tree: Tree,
    projectDetails: { projectName: string; root: string },
    inferredTargetConfiguration: InferredTargetConfiguration
  ) => {
    if (target.options) {
      handlePropertiesFromTargetOptions(target.options);
    }

    if (target.configurations) {
      for (const configurationName in target.configurations) {
        const configuration = target.configurations[configurationName];

        handlePropertiesFromTargetOptions(configuration);
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

    migrationLogs.addLog({
      project: projectDetails.projectName,
      executorName: '@nx/next:server',
      log: `Note that "nx run ${projectDetails.projectName}:${inferredTargetConfiguration.name}" only runs the dev server after the migration. To start the prod server, use "nx run ${projectDetails.projectName}:start".`,
    });

    return target;
  };
}

const executorFieldsToRename: Array<keyof NextServeBuilderOptions> = [
  'experimentalHttps',
  'experimentalHttpsCa',
  'experimentalHttpsKey',
  'keepAliveTimeout',
];

const executorFieldsToRemain: Array<keyof NextServeBuilderOptions> = [
  'port',
  'hostname',
];

const camelCaseToKebabCase = (str: string) =>
  str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

function handlePropertiesFromTargetOptions(options: NextServeBuilderOptions) {
  Object.keys(options).forEach((key) => {
    if (
      !executorFieldsToRename.includes(key as keyof NextServeBuilderOptions) &&
      !executorFieldsToRemain.includes(key as keyof NextServeBuilderOptions)
    ) {
      delete options[key];
    } else {
      if (
        executorFieldsToRename.includes(key as keyof NextServeBuilderOptions)
      ) {
        const value = options[key];
        const kebabCase = camelCaseToKebabCase(key);
        options['args'] ??= [];
        if (value === true || typeof value !== 'boolean') {
          options['args'].push(
            `--${kebabCase}` + (typeof value !== 'boolean' ? ` ${value}` : '')
          );
        }
        delete options[key];
      }
    }
  });
}
