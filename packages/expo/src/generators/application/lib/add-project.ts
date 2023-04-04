import {
  addProjectConfiguration,
  offsetFromRoot,
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nrwl/devkit';
import { NormalizedSchema } from './normalize-options';

export function addProject(host: Tree, options: NormalizedSchema) {
  const projectConfiguration: ProjectConfiguration = {
    root: options.appProjectRoot,
    sourceRoot: `${options.appProjectRoot}/src`,
    projectType: 'application',
    targets: { ...getTargets(options) },
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
    executor: '@nrwl/expo:start',
    options: {
      port: 8081,
    },
  };

  architect.serve = {
    executor: 'nx:run-commands',
    options: {
      command: `nx start ${options.name}`,
    },
  };

  architect['run-ios'] = {
    executor: '@nrwl/expo:run',
    options: {
      platform: 'ios',
    },
  };

  architect['run-android'] = {
    executor: '@nrwl/expo:run',
    options: {
      platform: 'android',
    },
  };

  architect['build'] = {
    executor: '@nrwl/expo:build',
    options: {},
  };

  architect['build-list'] = {
    executor: '@nrwl/expo:build-list',
    options: {},
  };

  architect['download'] = {
    executor: '@nrwl/expo:download',
    options: {
      output: `${options.appProjectRoot}/dist`,
    },
  };

  architect['sync-deps'] = {
    executor: '@nrwl/expo:sync-deps',
    options: {},
  };

  architect['ensure-symlink'] = {
    executor: '@nrwl/expo:ensure-symlink',
    options: {},
  };

  architect['prebuild'] = {
    executor: '@nrwl/expo:prebuild',
    options: {},
  };

  architect['install'] = {
    executor: '@nrwl/expo:install',
    options: {},
  };

  architect['update'] = {
    executor: '@nrwl/expo:update',
    options: {},
  };

  architect['export'] = {
    executor: '@nrwl/expo:export',
    options: {
      platform: 'all',
      outputDir: `${offsetFromRoot(options.appProjectRoot)}dist/${
        options.appProjectRoot
      }`,
    },
  };

  architect['export-web'] = {
    executor: '@nrwl/expo:export',
    options: {
      bundler: 'metro',
    },
  };

  return architect;
}
