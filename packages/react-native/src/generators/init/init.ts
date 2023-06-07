import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  detectPackageManager,
  formatFiles,
  GeneratorCallback,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { Schema } from './schema';

import { jestInitGenerator } from '@nx/jest';
import { detoxInitGenerator } from '@nx/detox';
import { babelPresetReactVersion } from '@nx/react/src/utils/versions';
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
      '@babel/preset-react': babelPresetReactVersion,
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
  return removeDependenciesFromPackageJson(host, ['@nx/react-native'], []);
}

export default reactNativeInitGenerator;
export const reactNativeInitSchematic = convertNxGenerator(
  reactNativeInitGenerator
);
