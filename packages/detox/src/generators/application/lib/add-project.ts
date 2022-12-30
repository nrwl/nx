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
  addProjectConfiguration(host, options.e2eProjectName, {
    root: options.e2eProjectRoot,
    sourceRoot: `${options.e2eProjectRoot}/src`,
    projectType: 'application',
    targets: { ...getTargets(options) },
    tags: [],
    implicitDependencies: [options.appProject],
  });
}

function getTargets(options: NormalizedSchema) {
  const targets: { [key: string]: TargetConfiguration } = {};

  targets['build-ios'] = {
    executor: '@nrwl/detox:build',
    ...(options.framework === 'react-native'
      ? reactNativeBuildTarget('ios.sim')
      : expoBuildTarget('ios.sim')),
  };

  targets['test-ios'] = {
    executor: '@nrwl/detox:test',
    ...(options.framework === 'react-native'
      ? reactNativeTestTarget('ios.sim', options.e2eName)
      : expoTestTarget('ios.sim', options.e2eName)),
  };

  targets['build-android'] = {
    executor: '@nrwl/detox:build',
    ...(options.framework === 'react-native'
      ? reactNativeBuildTarget('android.emu')
      : expoBuildTarget('android.emu')),
  };

  targets['test-android'] = {
    executor: '@nrwl/detox:test',
    ...(options.framework === 'react-native'
      ? reactNativeTestTarget('android.emu', options.e2eName)
      : expoTestTarget('android.emu', options.e2eName)),
  };

  return targets;
}
