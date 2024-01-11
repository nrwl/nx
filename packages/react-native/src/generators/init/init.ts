import {
  addDependenciesToPackageJson,
  detectPackageManager,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { Schema } from './schema';

import {
  babelCoreVersion,
  babelPresetReactVersion,
} from '@nx/react/src/utils/versions';
import { initGenerator as jsInitGenerator } from '@nx/js';

import {
  babelRuntimeVersion,
  jestReactNativeVersion,
  metroVersion,
  nxVersion,
  reactDomVersion,
  reactNativeCommunityCli,
  reactNativeCommunityCliAndroid,
  reactNativeCommunityCliIos,
  reactNativeMetroConfigVersion,
  reactNativeSvgTransformerVersion,
  reactNativeSvgVersion,
  reactNativeVersion,
  reactTestRendererVersion,
  reactVersion,
  testingLibraryJestNativeVersion,
  testingLibraryReactNativeVersion,
  typesNodeVersion,
  typesReactVersion,
} from '../../utils/versions';

import { addGitIgnoreEntry } from './lib/add-git-ignore-entry';
import { ReactNativePluginOptions } from '../../../plugins/plugin';

export async function reactNativeInitGenerator(host: Tree, schema: Schema) {
  addGitIgnoreEntry(host);
  const tasks: GeneratorCallback[] = [];

  tasks.push(
    await jsInitGenerator(host, {
      ...schema,
      skipFormat: true,
    })
  );

  if (!schema.skipPackageJson) {
    const installTask = updateDependencies(host);

    tasks.push(moveDependency(host));
    tasks.push(installTask);
  }

  if (process.env.NX_PCV3 === 'true') {
    addPlugin(host);
  }

  if (!schema.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export function updateDependencies(host: Tree) {
  const isPnpm = detectPackageManager(host.root) === 'pnpm';
  return addDependenciesToPackageJson(
    host,
    {
      react: reactVersion,
      'react-dom': reactDomVersion,
      'react-native': reactNativeVersion,
    },
    {
      '@nx/react-native': nxVersion,
      '@types/node': typesNodeVersion,
      '@types/react': typesReactVersion,
      '@react-native/metro-config': reactNativeMetroConfigVersion,
      '@react-native-community/cli': reactNativeCommunityCli,
      '@react-native-community/cli-platform-android':
        reactNativeCommunityCliAndroid,
      '@react-native-community/cli-platform-ios': reactNativeCommunityCliIos,
      '@testing-library/react-native': testingLibraryReactNativeVersion,
      '@testing-library/jest-native': testingLibraryJestNativeVersion,
      'jest-react-native': jestReactNativeVersion,
      metro: metroVersion,
      'metro-config': metroVersion,
      'metro-resolver': metroVersion,
      'metro-babel-register': metroVersion,
      'metro-react-native-babel-preset': metroVersion,
      'metro-react-native-babel-transformer': metroVersion,
      'react-test-renderer': reactTestRendererVersion,
      'react-native-svg-transformer': reactNativeSvgTransformerVersion,
      'react-native-svg': reactNativeSvgVersion,
      '@babel/preset-react': babelPresetReactVersion,
      '@babel/core': babelCoreVersion,
      ...(isPnpm
        ? {
            '@babel/runtime': babelRuntimeVersion, // @babel/runtime is used by react-native-svg
          }
        : {}),
    }
  );
}

function moveDependency(host: Tree) {
  return removeDependenciesFromPackageJson(host, ['@nx/react-native'], []);
}

function addPlugin(host: Tree) {
  const nxJson = readNxJson(host);
  nxJson.plugins ??= [];

  for (const plugin of nxJson.plugins) {
    if (
      typeof plugin === 'string'
        ? plugin === '@nx/react-native/plugin'
        : plugin.plugin === '@nx/react-native/plugin'
    ) {
      return;
    }
  }

  nxJson.plugins.push({
    plugin: '@nx/react-native/plugin',
    options: {
      startTargetName: 'start',
      bundleTargetName: 'bundle',
      runIosTargetName: 'run-ios',
      runAndroidTargetName: 'run-android',
      buildIosTargetName: 'build-ios',
      buildAndroidTargetName: 'build-android',
    } as ReactNativePluginOptions,
  });
  updateNxJson(host, nxJson);
}

export default reactNativeInitGenerator;
