import { TargetConfiguration, Tree } from '@nx/devkit';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import { NextServeBuilderOptions } from '../../../utils/types';

export function servePosTargetTransformer(migrationLogs: AggregatedLog) {
  return (
    target: TargetConfiguration<NextServeBuilderOptions>,
    tree: Tree,
    projectDetails: { projectName: string; root: string },
    inferredTargetConfiguration: TargetConfiguration
  ) => {
    if (target.options) {
      handlePropertiesFromTargetOptions(
        tree,
        target.options,
        projectDetails.projectName,
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

// TODO(nicholas): Clean up this function
function handlePropertiesFromTargetOptions(
  tree: Tree,
  options: NextServeBuilderOptions,
  projectName: string,
  migrationLogs: AggregatedLog
) {
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
