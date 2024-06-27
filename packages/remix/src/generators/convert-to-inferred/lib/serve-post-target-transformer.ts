import { type Tree, type TargetConfiguration } from '@nx/devkit';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import { REMIX_PROPERTY_MAPPINGS } from './utils';

export function servePostTargetTransformer(migrationLogs: AggregatedLog) {
  return (
    target: TargetConfiguration,
    tree: Tree,
    projectDetails: { projectName: string; root: string },
    inferredTargetConfiguration: TargetConfiguration
  ) => {
    if (target.options) {
      handlePropertiesFromTargetOptions(
        tree,
        target.options,
        projectDetails.projectName,
        projectDetails.root
      );
    }

    if (target.configurations) {
      for (const configurationName in target.configurations) {
        const configuration = target.configurations[configurationName];

        handlePropertiesFromTargetOptions(
          tree,
          configuration,
          projectDetails.projectName,
          projectDetails.root
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

function handlePropertiesFromTargetOptions(
  tree: Tree,
  options: any,
  projectName: string,
  projectRoot: string
) {
  if ('debug' in options) {
    delete options.debug;
  }

  if ('port' in options) {
    options.env ??= {};
    options.env.PORT = `${options.port}`;
    delete options.port;
  }

  for (const [prevKey, newKey] of Object.entries(REMIX_PROPERTY_MAPPINGS)) {
    if (prevKey in options) {
      let prevValue = options[prevKey];
      delete options[prevKey];
      options[newKey] = prevValue;
    }
  }
}
