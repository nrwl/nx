import {
  addProjectConfiguration,
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nrwl/devkit';
import { NormalizedSchema } from './normalize-options';

export function addProject(host: Tree, options: NormalizedSchema) {
  const project: ProjectConfiguration = {
    root: options.appProjectRoot,
    sourceRoot: `${options.appProjectRoot}/src`,
    projectType: 'application',
    targets: { ...getTargets(options) },
    tags: options.parsedTags,
  };

  addProjectConfiguration(host, options.projectName, {
    ...project,
  });
}

function getTargets(options: NormalizedSchema) {
  const architect: { [key: string]: TargetConfiguration } = {};

  architect.start = {
    executor: '@nrwl/react-native:start',
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
    executor: '@nrwl/react-native:run-ios',
    options: {},
  };

  architect['bundle-ios'] = {
    executor: '@nrwl/react-native:bundle',
    outputs: ['{options.bundleOutput}'],
    options: {
      entryFile: options.entryFile,
      platform: 'ios',
      bundleOutput: `dist/${options.appProjectRoot}/ios/main.jsbundle`,
    },
  };

  architect['run-android'] = {
    executor: '@nrwl/react-native:run-android',
    options: {},
  };

  architect['build-android'] = {
    executor: '@nrwl/react-native:build-android',
    outputs: [
      `{projectRoot}/android/app/build/outputs/bundle`,
      `{projectRoot}/android/app/build/outputs/apk`,
    ],
    options: {},
  };

  architect['build-ios'] = {
    executor: '@nrwl/react-native:build-ios',
    outputs: ['{projectRoot}/ios/build/Build'],
    options: {},
  };

  architect['pod-install'] = {
    executor: '@nrwl/react-native:pod-install',
    options: {},
  };

  architect['bundle-android'] = {
    executor: '@nrwl/react-native:bundle',
    outputs: ['{options.bundleOutput}'],
    options: {
      entryFile: options.entryFile,
      platform: 'android',
      bundleOutput: `dist/${options.appProjectRoot}/android/main.jsbundle`,
    },
  };

  architect['sync-deps'] = {
    executor: '@nrwl/react-native:sync-deps',
    options: {},
  };

  architect['ensure-symlink'] = {
    executor: '@nrwl/react-native:ensure-symlink',
    options: {},
  };

  return architect;
}
