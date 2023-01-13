import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  removeDependenciesFromPackageJson,
  Tree,
} from '@nrwl/devkit';
import { Schema } from './schema';
import {
  expoVersion,
  expoSplashScreenVersion,
  expoStatusBarVersion,
  nxVersion,
  reactNativeVersion,
  reactNativeWebVersion,
  typesReactNativeVersion,
  expoMetroConfigVersion,
  metroVersion,
  testingLibraryReactNativeVersion,
  testingLibraryJestNativeVersion,
  reactNativeSvgTransformerVersion,
  reactNativeSvgVersion,
  expoCliVersion,
  babelPresetExpoVersion,
  easCliVersion,
  deprecatedExpoCliVersion,
  expoWebpackConfig,
  reactVersion,
  reactTestRendererVersion,
  typesReactVersion,
  reactDomVersion,
} from '../../utils/versions';

import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { jestInitGenerator } from '@nrwl/jest';
import { detoxInitGenerator } from '@nrwl/detox';
import { jsInitGenerator } from '@nrwl/js';

import { addGitIgnoreEntry } from './lib/add-git-ignore-entry';
import { initRootBabelConfig } from './lib/init-root-babel-config';

export async function expoInitGenerator(host: Tree, schema: Schema) {
  addGitIgnoreEntry(host);
  initRootBabelConfig(host);

  const tasks = [
    moveDependency(host),
    jsInitGenerator(host, {
      skipPackageJson: schema.skipPackageJson,
      skipTsConfig: schema.skipTsConfig,
    }),
  ];

  if (!schema.skipPackageJson) {
    tasks.push(updateDependencies(host));
  }

  if (!schema.unitTestRunner || schema.unitTestRunner === 'jest') {
    const jestTask = jestInitGenerator(host, {});
    tasks.push(jestTask);
  }

  if (!schema.e2eTestRunner || schema.e2eTestRunner === 'detox') {
    const detoxTask = await detoxInitGenerator(host, { skipFormat: true });
    tasks.push(detoxTask);
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
      '@expo/webpack-config': expoWebpackConfig,
      'react-native-svg-transformer': reactNativeSvgTransformerVersion,
      'react-native-svg': reactNativeSvgVersion,
    },
    {
      '@nrwl/expo': nxVersion,
      '@types/react': typesReactVersion,
      '@types/react-native': typesReactNativeVersion,
      'metro-resolver': metroVersion,
      'react-test-renderer': reactTestRendererVersion,
      '@testing-library/react-native': testingLibraryReactNativeVersion,
      '@testing-library/jest-native': testingLibraryJestNativeVersion,
      'expo-cli': deprecatedExpoCliVersion,
      '@expo/cli': expoCliVersion,
      'eas-cli': easCliVersion,
      'babel-preset-expo': babelPresetExpoVersion,
    }
  );
}

function moveDependency(host: Tree) {
  return removeDependenciesFromPackageJson(host, ['@nrwl/react-native'], []);
}

export default expoInitGenerator;
export const expoInitSchematic = convertNxGenerator(expoInitGenerator);
