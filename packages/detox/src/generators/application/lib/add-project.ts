import {
  addProjectConfiguration,
  readNxJson,
  TargetConfiguration,
  Tree,
} from '@nx/devkit';
import {
  expoBuildTarget,
  expoTestTarget,
  reactNativeBuildTarget,
  reactNativeTestTarget,
} from './get-targets';
import { NormalizedSchema } from './normalize-options';

export function addProject(host: Tree, options: NormalizedSchema) {
  const nxJson = readNxJson(host);
  const hasPlugin = nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/detox/plugin'
      : p.plugin === '@nx/detox/plugin'
  );

  addProjectConfiguration(host, options.e2eProjectName, {
    root: options.e2eProjectRoot,
    sourceRoot: `${options.e2eProjectRoot}/src`,
    projectType: 'application',
    targets: hasPlugin ? {} : getTargets(options),
    tags: [],
    implicitDependencies: [options.appProject],
  });
}

function getTargets(options: NormalizedSchema) {
  const targets: { [key: string]: TargetConfiguration } = {};

  targets['build-ios'] = {
    executor: '@nx/detox:build',
    ...(options.framework === 'react-native'
      ? reactNativeBuildTarget('ios.sim')
      : expoBuildTarget('ios.sim')),
  };

  targets['test-ios'] = {
    executor: '@nx/detox:test',
    ...(options.framework === 'react-native'
      ? reactNativeTestTarget('ios.sim', options.e2eProjectName)
      : expoTestTarget('ios.sim', options.e2eProjectName)),
  };

  targets['build-android'] = {
    executor: '@nx/detox:build',
    ...(options.framework === 'react-native'
      ? reactNativeBuildTarget('android.emu')
      : expoBuildTarget('android.emu')),
  };

  targets['test-android'] = {
    executor: '@nx/detox:test',
    ...(options.framework === 'react-native'
      ? reactNativeTestTarget('android.emu', options.e2eProjectName)
      : expoTestTarget('android.emu', options.e2eProjectName)),
  };

  return targets;
}
