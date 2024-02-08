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
import { createNodes, ReactNativePluginOptions } from '../../../plugins/plugin';
import {
  nxVersion,
  reactDomVersion,
  reactNativeVersion,
  reactVersion,
} from '../../utils/versions';
import { addGitIgnoreEntry } from './lib/add-git-ignore-entry';
import { Schema } from './schema';

export function reactNativeInitGenerator(host: Tree, schema: Schema) {
  return reactNativeInitGeneratorInternal(host, {
    addPlugin: false,
    ...schema,
  });
}

export async function reactNativeInitGeneratorInternal(
  host: Tree,
  schema: Schema
) {
  addGitIgnoreEntry(host);

  schema.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';

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
    },
    {
      '@nx/react-native': nxVersion,
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
      podInstallTargetName: 'pod-install',
      bundleTargetName: 'bundle',
      runIosTargetName: 'run-ios',
      runAndroidTargetName: 'run-android',
      buildIosTargetName: 'build-ios',
      buildAndroidTargetName: 'build-android',
      syncDepsTargetName: 'sync-deps',
      upgradeTargetname: 'upgrade',
    } as ReactNativePluginOptions,
  });
  updateNxJson(host, nxJson);
}

export default reactNativeInitGenerator;
