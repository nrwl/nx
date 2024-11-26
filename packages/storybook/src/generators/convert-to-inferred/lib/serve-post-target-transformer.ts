import { joinPathFragments, TargetConfiguration, Tree } from '@nx/devkit';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import { toProjectRelativePath } from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';
import {
  ensureViteConfigPathIsRelative,
  getConfigFilePath,
  getInstalledPackageVersionInfo,
  STORYBOOK_PROP_MAPPINGS,
} from './utils';
export function servePostTargetTransformer(migrationLogs: AggregatedLog) {
  return (
    target: TargetConfiguration,
    tree: Tree,
    projectDetails: { projectName: string; root: string },
    inferredTargetConfiguration: TargetConfiguration
  ) => {
    let defaultConfigDir = getConfigFilePath(
      tree,
      joinPathFragments(projectDetails.root, '.storybook')
    );

    if (target.options) {
      if (target.options.configDir) {
        defaultConfigDir = target.options.configDir;
      }

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
        if (
          configuration.configDir &&
          configuration.configDir !== defaultConfigDir
        ) {
          ensureViteConfigPathIsRelative(
            tree,
            getConfigFilePath(tree, configuration.configDir),
            projectDetails.projectName,
            projectDetails.root,
            '@nx/storybook:storybook',
            migrationLogs
          );
        }

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

    ensureViteConfigPathIsRelative(
      tree,
      getConfigFilePath(tree, defaultConfigDir),
      projectDetails.projectName,
      projectDetails.root,
      '@nx/storybook:storybook',
      migrationLogs
    );

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
    if (!options.open) {
      options['args'] ??= [];
      options['args'].push('--no-open');
    }
    delete options.open;
  }

  if ('no-open' in options) {
    if (options['no-open']) {
      options['args'] ??= [];
      options['args'].push('--no-open');
    }
    delete options['no-open'];
  }

  if ('quiet' in options) {
    if (options['quiet']) {
      options['args'] ??= [];
      options['args'].push('--quiet');
    }
    delete options.quiet;
  }

  if ('docsMode' in options) {
    options.docs = options.docsMode;
    delete options.docsMode;
  }

  const storybookPropMappings =
    getInstalledPackageVersionInfo(tree, 'storybook')?.major === 8
      ? STORYBOOK_PROP_MAPPINGS.v8
      : STORYBOOK_PROP_MAPPINGS.v7;
  for (const [prevKey, newKey] of Object.entries(storybookPropMappings)) {
    if (prevKey in options) {
      let prevValue = options[prevKey];
      delete options[prevKey];
      options[newKey] = prevValue;
    }
  }
}
