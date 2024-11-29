import {
  addProjectConfiguration,
  joinPathFragments,
  ProjectConfiguration,
  readNxJson,
  TargetConfiguration,
  Tree,
  writeJson,
} from '@nx/devkit';
import { NormalizedSchema } from './normalize-options';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { getImportPath } from '@nx/js/src/utils/get-import-path';

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

  if (isUsingTsSolutionSetup(host)) {
    writeJson(host, joinPathFragments(options.appProjectRoot, 'package.json'), {
      name: getImportPath(host, options.name),
      version: '0.0.1',
      private: true,
      nx: {
        name: options.name,
        projectType: 'application',
        sourceRoot: `${options.appProjectRoot}/src`,
        targets: hasPlugin ? {} : getTargets(options),
        tags: options.parsedTags?.length ? options.parsedTags : undefined,
      },
    });
  } else {
    addProjectConfiguration(host, options.projectName, {
      ...project,
    });
  }
}

function getTargets(options: NormalizedSchema) {
  const architect: { [key: string]: TargetConfiguration } = {};

  architect.start = {
    executor: '@nx/react-native:start',
    dependsOn: [],
    options: {
      port: 8081,
    },
  };

  architect['run-ios'] = {
    executor: '@nx/react-native:run-ios',
    dependsOn: [],
    options: {},
  };

  architect['bundle-ios'] = {
    executor: '@nx/react-native:bundle',
    dependsOn: [],
    outputs: ['{options.bundleOutput}'],
    options: {
      entryFile: options.entryFile,
      platform: 'ios',
      bundleOutput: `dist/${options.appProjectRoot}/ios/main.jsbundle`,
    },
  };

  architect['run-android'] = {
    executor: '@nx/react-native:run-android',
    dependsOn: [],
    options: {},
  };

  architect['build-android'] = {
    executor: '@nx/react-native:build-android',
    outputs: [
      `{projectRoot}/android/app/build/outputs/bundle`,
      `{projectRoot}/android/app/build/outputs/apk`,
    ],
    dependsOn: [],
    options: {},
  };

  architect['build-ios'] = {
    executor: '@nx/react-native:build-ios',
    outputs: ['{projectRoot}/ios/build/Build'],
    dependsOn: [],
    options: {},
  };

  architect['pod-install'] = {
    executor: '@nx/react-native:pod-install',
    dependsOn: ['sync-deps'],
    outputs: ['{projectRoot}/ios/Pods', '{projectRoot}/ios/Podfile.lock'],
    options: {},
  };

  architect.upgrade = {
    executor: '@nx/react-native:upgrade',
    options: {},
  };

  architect['bundle-android'] = {
    executor: '@nx/react-native:bundle',
    dependsOn: [],
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

  return architect;
}
