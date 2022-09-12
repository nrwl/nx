import {
  addProjectConfiguration,
  ProjectConfiguration,
  readWorkspaceConfiguration,
  TargetConfiguration,
  Tree,
  updateWorkspaceConfiguration,
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

  const workspace = readWorkspaceConfiguration(host);

  if (!workspace.defaultProject) {
    workspace.defaultProject = options.projectName;

    updateWorkspaceConfiguration(host, workspace);
  }
}

function getTargets(options: NormalizedSchema) {
  const architect: { [key: string]: TargetConfiguration } = {};

  architect.start = {
    executor: '@nrwl/expo:start',
    options: {
      port: 8081,
    },
  };

  architect.web = {
    executor: '@nrwl/expo:start',
    options: {
      port: 8081,
      webpack: true,
    },
  };

  architect.serve = {
    executor: '@nrwl/workspace:run-commands',
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

  architect['build-ios'] = {
    executor: '@nrwl/expo:build-ios',
    options: {},
  };

  architect['build-android'] = {
    executor: '@nrwl/expo:build-android',
    options: {},
  };

  architect['build-web'] = {
    executor: '@nrwl/expo:build-web',
    options: {},
  };

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

  architect['publish'] = {
    executor: '@nrwl/expo:publish',
    options: {},
  };

  architect['publish-set'] = {
    executor: '@nrwl/expo:publish-set',
    options: {},
  };

  architect['rollback'] = {
    executor: '@nrwl/expo:rollback',
    options: {},
  };

  architect['eject'] = {
    executor: '@nrwl/expo:eject',
    options: {},
  };

  return architect;
}
