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

  // @deprecated, no longer supported in @expo/cli
  architect['build-ios'] = {
    executor: '@nrwl/expo:build-ios',
    options: {},
  };

  // @deprecated, no longer supported in @expo/cli
  architect['build-android'] = {
    executor: '@nrwl/expo:build-android',
    options: {},
  };

  // @deprecated, no longer supported in @expo/cli
  architect['build-web'] = {
    executor: '@nrwl/expo:build-web',
    options: {},
  };

  // @deprecated, no longer supported in @expo/cli
  architect['build-status'] = {
    executor: '@nrwl/expo:build-web',
    options: {},
  };

  architect['sync-deps'] = {
    executor: '@nrwl/expo:sync-deps',
    options: {},
  };

  architect['ensure-symlink'] = {
    executor: '@nrwl/expo:ensure-symlink',
    options: {},
  };

  // @deprecated, no longer supported in @expo/cli
  architect['publish'] = {
    executor: '@nrwl/expo:publish',
    options: {},
  };

  // @deprecated, no longer supported in @expo/cli
  architect['publish-set'] = {
    executor: '@nrwl/expo:publish-set',
    options: {},
  };

  // @deprecated, no longer supported in @expo/cli
  architect['rollback'] = {
    executor: '@nrwl/expo:rollback',
    options: {},
  };

  architect['prebuild'] = {
    executor: '@nrwl/expo:prebuild',
    options: {},
  };

  // @deprecated, no longer supported in @expo/cli
  architect['eject'] = {
    executor: 'nx:run-commands',
    options: {
      command: `nx prebuild ${options.name}`,
    },
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
