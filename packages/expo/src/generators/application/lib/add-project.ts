import {
  addProjectConfiguration,
  offsetFromRoot,
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nx/devkit';
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
    executor: '@nx/expo:start',
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
    executor: '@nx/expo:run',
    options: {
      platform: 'ios',
    },
  };

  architect['run-android'] = {
    executor: '@nx/expo:run',
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

  architect['download'] = {
    executor: '@nx/expo:download',
    options: {
      output: `${options.appProjectRoot}/dist`,
    },
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
