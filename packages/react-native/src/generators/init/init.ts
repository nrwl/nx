import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  detectPackageManager,
  formatFiles,
  GeneratorCallback,
  removeDependenciesFromPackageJson,
  Tree,
} from '@nrwl/devkit';
import { Schema } from './schema';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { addBabelInputs } from '@nrwl/js/src/utils/add-babel-inputs';

import { jestInitGenerator } from '@nrwl/jest';
import { detoxInitGenerator } from '@nrwl/detox';

import {
  babelRuntimeVersion,
  jestReactNativeVersion,
  metroVersion,
  nxVersion,
  reactDomVersion,
  reactNativeAsyncStorageAsyncStorageVersion,
  reactNativeCommunityCli,
  reactNativeCommunityCliAndroid,
  reactNativeCommunityCliIos,
  reactNativeConfigVersion,
  reactNativeSvgTransformerVersion,
  reactNativeSvgVersion,
  reactNativeVersion,
  reactTestRendererVersion,
  reactVersion,
  testingLibraryJestNativeVersion,
  testingLibraryReactNativeVersion,
  typesNodeVersion,
  typesReactNativeVersion,
  typesReactVersion,
} from '../../utils/versions';

import { addGitIgnoreEntry } from './lib/add-git-ignore-entry';
import { jsInitGenerator } from '@nrwl/js';

export async function reactNativeInitGenerator(host: Tree, schema: Schema) {
  addGitIgnoreEntry(host);
  addBabelInputs(host);

  const tasks: GeneratorCallback[] = [
    await jsInitGenerator(host, {
      skipPackageJson: schema.skipPackageJson,
    }),
  ];

  if (!schema.skipPackageJson) {
    const installTask = updateDependencies(host);

    tasks.push(moveDependency(host));
    tasks.push(installTask);
  }

  if (!schema.unitTestRunner || schema.unitTestRunner === 'jest') {
    const jestTask = jestInitGenerator(host, schema);
    tasks.push(jestTask);
  }

  if (!schema.e2eTestRunner || schema.e2eTestRunner === 'detox') {
    const detoxTask = await detoxInitGenerator(host, {});
    tasks.push(detoxTask);
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
      '@nrwl/react-native': nxVersion,
      '@types/node': typesNodeVersion,
      '@types/react': typesReactVersion,
      '@types/react-native': typesReactNativeVersion,
      '@react-native-community/cli': reactNativeCommunityCli,
      '@react-native-community/cli-platform-android':
        reactNativeCommunityCliAndroid,
      '@react-native-community/cli-platform-ios': reactNativeCommunityCliIos,
      '@testing-library/react-native': testingLibraryReactNativeVersion,
      '@testing-library/jest-native': testingLibraryJestNativeVersion,
      'jest-react-native': jestReactNativeVersion,
      metro: metroVersion,
      'metro-resolver': metroVersion,
      'metro-babel-register': metroVersion,
      'metro-react-native-babel-preset': metroVersion,
      'metro-react-native-babel-transformer': metroVersion,
      'react-test-renderer': reactTestRendererVersion,
      'react-native-svg-transformer': reactNativeSvgTransformerVersion,
      'react-native-svg': reactNativeSvgVersion,
      'react-native-config': reactNativeConfigVersion,
      '@react-native-async-storage/async-storage':
        reactNativeAsyncStorageAsyncStorageVersion,
      ...(isPnpm
        ? {
            'metro-config': metroVersion, // metro-config is used by metro.config.js
            '@babel/runtime': babelRuntimeVersion, // @babel/runtime is used by react-native-svg
          }
        : {}),
    }
  );
}

function moveDependency(host: Tree) {
  return removeDependenciesFromPackageJson(host, ['@nrwl/react-native'], []);
}

export default reactNativeInitGenerator;
export const reactNativeInitSchematic = convertNxGenerator(
  reactNativeInitGenerator
);
