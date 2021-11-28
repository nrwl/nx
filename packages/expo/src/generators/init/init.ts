import { setDefaultCollection } from '@nrwl/workspace/src/utilities/set-default-collection';
import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  removeDependenciesFromPackageJson,
  Tree,
} from '@nrwl/devkit';
import { Schema } from './schema';
import {
  expoStatusBarVersion,
  expoVersion,
  nxVersion,
  reactNativeVersion,
  reactNativeWebVersion,
  typesReactNativeVersion,
  expoMetroConfigVersion,
  metroVersion,
  expoStructuredHeadersVersion,
  expoSplashScreenVersion,
  expoUpdatesVersion,
  reactNativeGestureHandlerVersion,
  reactNativeReanimatedVersion,
  reactNativeSafeAreaContextVersion,
  reactNativeScreensVersion,
  testingLibraryReactNativeVersion,
  testingLibraryJestNativeVersion,
  jestExpoVersion,
} from '../../utils/versions';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { addGitIgnoreEntry } from './lib/add-git-ignore-entry';
import { jestInitGenerator } from '@nrwl/jest';
import { detoxInitGenerator } from '@nrwl/detox';
import {
  reactVersion,
  typesReactVersion,
} from '@nrwl/react/src/utils/versions';

export async function expoInitGenerator(host: Tree, schema: Schema) {
  setDefaultCollection(host, '@nrwl/expo');
  addGitIgnoreEntry(host);

  const tasks = [moveDependency(host), updateDependencies(host)];

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
      'react-dom': reactVersion,
      'react-native': reactNativeVersion,
      expo: expoVersion,
      'expo-status-bar': expoStatusBarVersion,
      'react-native-web': reactNativeWebVersion,
      '@expo/metro-config': expoMetroConfigVersion,
      'expo-structured-headers': expoStructuredHeadersVersion,
      'expo-splash-screen': expoSplashScreenVersion,
      'expo-updates': expoUpdatesVersion,
      'react-native-gesture-handler': reactNativeGestureHandlerVersion,
      'react-native-reanimated': reactNativeReanimatedVersion,
      'react-native-safe-area-context': reactNativeSafeAreaContextVersion,
      'react-native-screens': reactNativeScreensVersion,
    },
    {
      '@nrwl/expo': nxVersion,
      '@types/react': typesReactVersion,
      '@types/react-native': typesReactNativeVersion,
      'metro-resolver': metroVersion,
      '@testing-library/react-native': testingLibraryReactNativeVersion,
      '@testing-library/jest-native': testingLibraryJestNativeVersion,
      'jest-expo': jestExpoVersion,
    }
  );
}

function moveDependency(host: Tree) {
  return removeDependenciesFromPackageJson(host, ['@nrwl/react-native'], []);
}

export default expoInitGenerator;
export const reactNativeInitSchematic = convertNxGenerator(expoInitGenerator);
