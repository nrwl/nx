import {
  addProjectConfiguration,
  ProjectConfiguration,
  readNxJson,
  TargetConfiguration,
  Tree,
} from '@nx/devkit';
import { NormalizedSchema } from './normalize-options';

export function addProject(host: Tree, options: NormalizedSchema) {
  const nxJson = readNxJson(host);
  const hasPlugin = nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/react-native/plugin'
      : p.plugin === '@nx/react-native/plugin'
  );

  const project: ProjectConfiguration = {
    root: options.appProjectRoot,
    sourceRoot: `${options.appProjectRoot}/src`,
    projectType: 'application',
    targets: hasPlugin ? {} : getTargets(options),
    tags: options.parsedTags,
  };

  addProjectConfiguration(host, options.projectName, {
    ...project,
  });
}

function getTargets(options: NormalizedSchema) {
  const architect: { [key: string]: TargetConfiguration } = {};

  architect.start = {
    executor: '@nx/react-native:start',
    dependsOn: ['ensure-symlink', 'sync-deps', 'pod-install'],
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
    executor: '@nx/react-native:run-ios',
    dependsOn: ['ensure-symlink', 'sync-deps', 'pod-install'],
    options: {},
  };

  architect['bundle-ios'] = {
    executor: '@nx/react-native:bundle',
    dependsOn: ['ensure-symlink'],
    outputs: ['{options.bundleOutput}'],
    options: {
      entryFile: options.entryFile,
      platform: 'ios',
      bundleOutput: `dist/${options.appProjectRoot}/ios/main.jsbundle`,
    },
  };

  architect['run-android'] = {
    executor: '@nx/react-native:run-android',
    dependsOn: ['ensure-symlink', 'sync-deps'],
    options: {},
  };

  architect['build-android'] = {
    executor: '@nx/react-native:build-android',
    outputs: [
      `{projectRoot}/android/app/build/outputs/bundle`,
      `{projectRoot}/android/app/build/outputs/apk`,
    ],
    dependsOn: ['ensure-symlink', 'sync-deps'],
    options: {},
  };

  architect['build-ios'] = {
    executor: '@nx/react-native:build-ios',
    outputs: ['{projectRoot}/ios/build/Build'],
    dependsOn: ['ensure-symlink', 'sync-deps', 'pod-install'],
    options: {},
  };

  architect['pod-install'] = {
    executor: '@nx/react-native:pod-install',
    options: {},
  };

  architect['bundle-android'] = {
    executor: '@nx/react-native:bundle',
    dependsOn: ['ensure-symlink'],
    outputs: ['{options.bundleOutput}'],
    options: {
      entryFile: options.entryFile,
      platform: 'android',
      bundleOutput: `dist/${options.appProjectRoot}/android/main.jsbundle`,
    },
  };

  architect['sync-deps'] = {
    executor: '@nx/react-native:sync-deps',
    options: {},
  };

  architect['ensure-symlink'] = {
    executor: '@nx/react-native:ensure-symlink',
    options: {},
  };

  return architect;
}
