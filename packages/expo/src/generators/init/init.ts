import {
  addDependenciesToPackageJson,
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
  babelPresetExpoVersion,
  easCliVersion,
  expoCliVersion,
  expoMetroConfigVersion,
  expoSplashScreenVersion,
  expoStatusBarVersion,
  expoVersion,
  jestExpoVersion,
  metroVersion,
  nxVersion,
  reactDomVersion,
  reactNativeSvgTransformerVersion,
  reactNativeSvgVersion,
  reactNativeVersion,
  reactNativeWebVersion,
  reactTestRendererVersion,
  reactVersion,
  testingLibraryJestNativeVersion,
  testingLibraryReactNativeVersion,
  typesReactVersion,
} from '../../utils/versions';
import { ExpoPluginOptions } from '../../../plugins/plugin';
import { hasExpoPlugin } from '../../utils/has-expo-plugin';

import { jestInitGenerator } from '@nx/jest';
import { detoxInitGenerator } from '@nx/detox';
import { initGenerator as jsInitGenerator } from '@nx/js';

import { addGitIgnoreEntry } from './lib/add-git-ignore-entry';
import { initRootBabelConfig } from './lib/init-root-babel-config';

export async function expoInitGenerator(host: Tree, schema: Schema) {
  addGitIgnoreEntry(host);
  initRootBabelConfig(host);

  const tasks: GeneratorCallback[] = [];

  tasks.push(
    await jsInitGenerator(host, {
      ...schema,
      skipFormat: true,
    })
  );

  if (!schema.skipPackageJson) {
    tasks.push(moveDependency(host));
    tasks.push(updateDependencies(host));
  }

  if (!schema.unitTestRunner || schema.unitTestRunner === 'jest') {
    const jestTask = await jestInitGenerator(host, schema);
    tasks.push(jestTask);
  }

  if (!schema.e2eTestRunner || schema.e2eTestRunner === 'detox') {
    const detoxTask = await detoxInitGenerator(host, {
      ...schema,
      skipFormat: true,
    });
    tasks.push(detoxTask);
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
  return addDependenciesToPackageJson(
    host,
    {
      react: reactVersion,
      'react-dom': reactDomVersion,
      'react-native': reactNativeVersion,
      expo: expoVersion,
      'expo-splash-screen': expoSplashScreenVersion,
      'expo-status-bar': expoStatusBarVersion,
      'react-native-web': reactNativeWebVersion,
      '@expo/metro-config': expoMetroConfigVersion,
      'react-native-svg-transformer': reactNativeSvgTransformerVersion,
      'react-native-svg': reactNativeSvgVersion,
    },
    {
      '@nx/expo': nxVersion,
      '@types/react': typesReactVersion,
      metro: metroVersion,
      'metro-resolver': metroVersion,
      'react-test-renderer': reactTestRendererVersion,
      '@testing-library/react-native': testingLibraryReactNativeVersion,
      '@testing-library/jest-native': testingLibraryJestNativeVersion,
      'jest-expo': jestExpoVersion,
      '@expo/cli': expoCliVersion,
      'eas-cli': easCliVersion,
      'babel-preset-expo': babelPresetExpoVersion,
    }
  );
}

function moveDependency(host: Tree) {
  return removeDependenciesFromPackageJson(host, ['@nx/react-native'], []);
}

function addPlugin(host: Tree) {
  const nxJson = readNxJson(host);

  if (hasExpoPlugin(host)) {
    return;
  }

  nxJson.plugins ??= [];
  nxJson.plugins.push({
    plugin: '@nx/expo/plugin',
    options: {
      startTargetName: 'start',
      runIosTargetName: 'run-ios',
      runAndroidTargetName: 'run-android',
      exportTargetName: 'export',
      exportWebTargetName: 'export-web',
      prebuildTargetName: 'prebuild',
      installTargetName: 'install',
      buildTargetName: 'build',
      submitTargetName: 'submit',
    } as ExpoPluginOptions,
  });
  updateNxJson(host, nxJson);
}

export default expoInitGenerator;
