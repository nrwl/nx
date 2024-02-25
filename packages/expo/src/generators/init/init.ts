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
import { updatePackageScripts } from '@nx/devkit/src/utils/update-package-scripts';
import { createNodes, ExpoPluginOptions } from '../../../plugins/plugin';
import {
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

export function expoInitGenerator(tree: Tree, schema: Schema) {
  return expoInitGeneratorInternal(tree, { addPlugin: false, ...schema });
}

export async function expoInitGeneratorInternal(host: Tree, schema: Schema) {
  schema.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';

  addGitIgnoreEntry(host);

  if (schema.addPlugin) {
    addPlugin(host);
  }

  const tasks: GeneratorCallback[] = [];
  if (!schema.skipPackageJson) {
    tasks.push(moveDependency(host));
    tasks.push(updateDependencies(host, schema));
  }

  if (schema.updatePackageScripts) {
    await updatePackageScripts(host, createNodes);
  }

  if (!schema.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export function updateDependencies(host: Tree, schema: Schema) {
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
    },
    undefined,
    schema.keepExistingVersions
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
      serveTargetName: 'serve',
      runIosTargetName: 'run-ios',
      runAndroidTargetName: 'run-android',
      exportTargetName: 'export',
      prebuildTargetName: 'prebuild',
      installTargetName: 'install',
      buildTargetName: 'build',
      submitTargetName: 'submit',
    } as ExpoPluginOptions,
  });
  updateNxJson(host, nxJson);
}

export default expoInitGenerator;
