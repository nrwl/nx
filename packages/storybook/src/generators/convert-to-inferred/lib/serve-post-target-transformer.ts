import { TargetConfiguration, Tree } from '@nx/devkit';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import { toProjectRelativePath } from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';
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

function handlePropertiesFromTargetOptions(
  tree: Tree,
  options: any,
  projectName: string,
  projectRoot: string,
  migrationLogs: AggregatedLog
) {
  if ('configDir' in options) {
    options.configDir = toProjectRelativePath(options.configDir, projectRoot);
  }

  if (options.outputDir) {
    options.outputDir = toProjectRelativePath(options.outputDir, projectRoot);
  }

  if ('uiFramework' in options) {
    delete options.uiFramework;
  }
  if ('staticDir' in options) {
    migrationLogs.addLog({
      project: projectName,
      executorName: '@nx/storybook:storybook',
      log: 'Could not migrate `staticDir`. Update your `main.ts` file to add `staticDirs`.',
    });
    delete options.staticDir;
  }
  if ('open' in options) {
    options['no-open'] = !options.open;
    delete options.open;
  }

  for (const [prevKey, newKey] of Object.entries(STORYBOOK_PROP_MAPPINGS)) {
    if (prevKey in options) {
      options[newKey] = options[prevKey];
      delete options[prevKey];
    }
  }
}

const STORYBOOK_PROP_MAPPINGS = {
  port: 'port',
  previewUrl: 'preview-url',
  host: 'host',
  docs: 'docs',
  configDir: 'config-dir',
  logLevel: 'loglevel',
  quiet: 'quiet',
  webpackStatsJson: 'stats-json',
  debugWebpack: 'debug-webpack',
  disableTelemetry: 'disable-telemetry',
  https: 'https',
  sslCa: 'ssl-ca',
  sslCert: 'ssl-cert',
  sslKey: 'ssl-key',
  smokeTest: 'smoke-test',
  noOpen: 'no-open',
};
