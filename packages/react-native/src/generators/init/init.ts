import { addPlugin } from '@nx/devkit/internal';
import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  GeneratorCallback,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { createNodesV2 } from '../../../plugins/plugin';
import {
  nxVersion,
  reactDomVersion,
  reactVersion,
  versions,
} from '../../utils/versions';
import { assertSupportedReactNativeVersion } from '../../utils/assert-supported-react-native-version';
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
  assertSupportedReactNativeVersion(host);

  addGitIgnoreEntry(host);

  const nxJson = readNxJson(host);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  schema.addPlugin ??= addPluginDefault;

  if (schema.addPlugin) {
    await addPlugin(
      host,
      await createProjectGraphAsync(),
      '@nx/react-native/plugin',
      createNodesV2,
      {
        startTargetName: ['start', 'react-native:start', 'react-native-start'],
        upgradeTargetName: [
          'update',
          'react-native:update',
          'react-native-update',
        ],
        bundleTargetName: [
          'bundle',
          'react-native:bundle',
          'react-native-bundle',
        ],

        podInstallTargetName: [
          'pod-install',
          'react-native:pod-install',
          'react-native-pod-install',
        ],
        runIosTargetName: [
          'run-ios',
          'react-native:run-ios',
          'react-native-run-ios',
        ],
        runAndroidTargetName: [
          'run-android',
          'react-native:run-android',
          'react-native-run-android',
        ],
        buildIosTargetName: [
          'build-ios',
          'react-native:build-ios',
          'react-native-build-ios',
        ],
        buildAndroidTargetName: [
          'build-android',
          'react-native:build-android',
          'react-native-build-android',
        ],
        syncDepsTargetName: [
          'sync-deps',
          'react-native:sync-deps',
          'react-native-sync-deps',
        ],
      },
      schema.updatePackageScripts
    );
  }

  const tasks: GeneratorCallback[] = [];
  if (!schema.skipPackageJson) {
    tasks.push(moveDependency(host));
    tasks.push(updateDependencies(host, schema));
  }

  if (!schema.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export function updateDependencies(host: Tree, schema: Schema) {
  const rnVersions = versions(host);
  return addDependenciesToPackageJson(
    host,
    {
      react: reactVersion,
      'react-dom': reactDomVersion,
      'react-native': rnVersions.reactNativeVersion,
    },
    {
      '@nx/react-native': nxVersion,
      'metro-config': rnVersions.metroVersion,
      'metro-resolver': rnVersions.metroVersion,
    },
    undefined,
    schema.keepExistingVersions ?? true
  );
}

function moveDependency(host: Tree) {
  return removeDependenciesFromPackageJson(host, ['@nx/react-native'], []);
}

export default reactNativeInitGenerator;
