import {
  addProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nrwl/devkit';
import {
  expoBuildTarget,
  expoTestTarget,
  reactNativeBuildTarget,
  reactNativeTestTarget,
} from './get-targets';
import { NormalizedSchema } from './normalize-options';

export function addProject(host: Tree, options: NormalizedSchema) {
  addProjectConfiguration(host, options.projectName, {
    root: options.projectRoot,
    sourceRoot: `${options.projectRoot}/src`,
    projectType: 'application',
    targets: { ...getTargets(options) },
    tags: [],
    implicitDependencies: options.project ? [options.project] : undefined,
  });
}

function getTargets(options: NormalizedSchema) {
  const targets: { [key: string]: TargetConfiguration } = {};

  targets['build-ios'] = {
    executor: '@nrwl/detox:build',
    ...(options.framework === 'react-native'
      ? reactNativeBuildTarget('ios')
      : expoBuildTarget('ios')),
  };

  targets['test-ios'] = {
    executor: '@nrwl/detox:test',
    ...(options.framework === 'react-native'
      ? reactNativeTestTarget('ios', options.name)
      : expoTestTarget('ios', options.name)),
  };

  targets['build-android'] = {
    executor: '@nrwl/detox:build',
    ...(options.framework === 'react-native'
      ? reactNativeBuildTarget('android')
      : expoBuildTarget('android')),
  };

  targets['test-android'] = {
    executor: '@nrwl/detox:test',
    ...(options.framework === 'react-native'
      ? reactNativeTestTarget('android', options.name)
      : expoTestTarget('android', options.name)),
  };

  return targets;
}
