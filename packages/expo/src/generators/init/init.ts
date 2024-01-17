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
import { ExpoPluginOptions } from '../../../plugins/plugin';
import {
  easCliVersion,
  expoCliVersion,
  expoVersion,
  nxVersion,
  reactDomVersion,
  reactNativeVersion,
  reactVersion,
} from '../../utils/versions';
import { hasExpoPlugin } from '../../utils/has-expo-plugin';
import { addGitIgnoreEntry } from './lib/add-git-ignore-entry';
import { Schema } from './schema';

export async function expoInitGenerator(host: Tree, schema: Schema) {
  addGitIgnoreEntry(host);

  if (process.env.NX_PCV3 === 'true') {
    addPlugin(host);
  }

  const tasks: GeneratorCallback[] = [];
  if (!schema.skipPackageJson) {
    tasks.push(moveDependency(host));
    tasks.push(updateDependencies(host));
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
    },
    {
      '@nx/expo': nxVersion,
      '@expo/cli': expoCliVersion,
      'eas-cli': easCliVersion,
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
