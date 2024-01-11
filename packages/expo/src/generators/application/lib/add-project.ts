import {
  addProjectConfiguration,
  offsetFromRoot,
  ProjectConfiguration,
  readNxJson,
  TargetConfiguration,
  Tree,
} from '@nx/devkit';

import { hasExpoPlugin } from '../../../utils/has-expo-plugin';
import { NormalizedSchema } from './normalize-options';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/add-build-target-defaults';

export function addProject(host: Tree, options: NormalizedSchema) {
  const nxJson = readNxJson(host);
  const hasPlugin = hasExpoPlugin(host);

  if (!hasPlugin) {
    addBuildTargetDefaults(host, '@nx/expo:build');
  }

  const projectConfiguration: ProjectConfiguration = {
    root: options.appProjectRoot,
    sourceRoot: `${options.appProjectRoot}/src`,
    projectType: 'application',
    targets: hasPlugin ? {} : getTargets(options),
    tags: options.parsedTags,
  };

  addProjectConfiguration(
    host,
    options.projectName,
    projectConfiguration,
    options.standaloneConfig
  );
}

function getTargets(options: NormalizedSchema) {
  const architect: { [key: string]: TargetConfiguration } = {};

  architect.start = {
    executor: '@nx/expo:start',
    dependsOn: ['ensure-symlink', 'sync-deps'],
    options: {
      port: 8081,
    },
  };

  architect.serve = {
    executor: 'nx:run-commands',
    options: {
      command: `nx start ${options.projectName}`,
    },
  };

  architect['run-ios'] = {
    executor: '@nx/expo:run',
    dependsOn: ['ensure-symlink', 'sync-deps'],
    options: {
      platform: 'ios',
    },
  };

  architect['run-android'] = {
    executor: '@nx/expo:run',
    dependsOn: ['ensure-symlink', 'sync-deps'],
    options: {
      platform: 'android',
    },
  };

  architect['build'] = {
    executor: '@nx/expo:build',
    options: {},
  };

  architect['submit'] = {
    executor: '@nx/expo:submit',
    options: {},
  };

  architect['build-list'] = {
    executor: '@nx/expo:build-list',
    options: {},
  };

  architect['sync-deps'] = {
    executor: '@nx/expo:sync-deps',
    options: {},
  };

  architect['ensure-symlink'] = {
    executor: '@nx/expo:ensure-symlink',
    options: {},
  };

  architect['prebuild'] = {
    executor: '@nx/expo:prebuild',
    dependsOn: ['ensure-symlink', 'sync-deps'],
    options: {},
  };

  architect['install'] = {
    executor: '@nx/expo:install',
    options: {},
  };

  architect['update'] = {
    executor: '@nx/expo:update',
    options: {},
  };

  architect['export'] = {
    executor: '@nx/expo:export',
    dependsOn: ['ensure-symlink', 'sync-deps'],
    options: {
      platform: 'all',
      outputDir: `${offsetFromRoot(options.appProjectRoot)}dist/${
        options.appProjectRoot
      }`,
    },
  };

  architect['export-web'] = {
    executor: '@nx/expo:export',
    options: {
      bundler: 'metro',
    },
  };

  return architect;
}
