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
import { coerce, major } from 'semver';
import { createNodesV2 } from '../../../plugins/plugin';
import { assertSupportedExpoVersion, nxVersion } from '../../utils/versions';
import { getExpoDependenciesVersionsToInstall } from '../../utils/version-utils';

import { addGitIgnoreEntry } from './lib/add-git-ignore-entry';
import { Schema } from './schema';

export function expoInitGenerator(tree: Tree, schema: Schema) {
  return expoInitGeneratorInternal(tree, { addPlugin: false, ...schema });
}

export async function expoInitGeneratorInternal(host: Tree, schema: Schema) {
  assertSupportedExpoVersion(host);

  const nxJson = readNxJson(host);
  const addPluginDefault =
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;
  schema.addPlugin ??= addPluginDefault;

  addGitIgnoreEntry(host);

  if (schema.addPlugin) {
    await addPlugin(
      host,
      await createProjectGraphAsync(),
      '@nx/expo/plugin',
      createNodesV2,
      {
        startTargetName: ['start', 'expo:start', 'expo-start'],
        buildTargetName: ['build', 'expo:build', 'expo-build'],
        prebuildTargetName: ['prebuild', 'expo:prebuild', 'expo-prebuild'],
        serveTargetName: ['serve', 'expo:serve', 'expo-serve'],
        installTargetName: ['install', 'expo:install', 'expo-install'],
        exportTargetName: ['export', 'expo:export', 'expo-export'],
        submitTargetName: ['submit', 'expo:submit', 'expo-submit'],
        runIosTargetName: ['run-ios', 'expo:run-ios', 'expo-run-ios'],
        runAndroidTargetName: [
          'run-android',
          'expo:run-android',
          'expo-run-android',
        ],
        buildDepsTargetName: [
          'build-deps',
          'expo:build-deps',
          'expo-build-deps',
        ],
        watchDepsTargetName: [
          'watch-deps',
          'expo:watch-deps',
          'expo-watch-deps',
        ],
      },

      schema.updatePackageScripts
    );
  }

  const tasks: GeneratorCallback[] = [];
  if (!schema.skipPackageJson) {
    tasks.push(moveDependency(host));
    tasks.push(await updateDependencies(host, schema));
  }

  if (!schema.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export async function updateDependencies(host: Tree, schema: Schema) {
  const versions = await getExpoDependenciesVersionsToInstall(host);

  // Expo SDK 55+ provides Metro through `@expo/metro` (a transitive dependency
  // of `expo`). Installing the standalone `metro-config`/`metro-resolver`
  // packages alongside it pulls in a second, incompatible Metro instance and
  // breaks bundling, so only add them for older SDKs (53/54).
  const expoMajor = major(coerce(versions.expo) ?? '0.0.0');
  const usesExpoMetro = expoMajor >= 55;

  return addDependenciesToPackageJson(
    host,
    {
      react: versions.react,
      'react-dom': versions.reactDom,
      'react-native': versions.reactNative,
      expo: versions.expo,
    },
    {
      '@nx/expo': nxVersion,
      '@expo/cli': versions.expoCli,
      ...(usesExpoMetro
        ? {}
        : {
            'metro-config': versions.metro,
            'metro-resolver': versions.metro,
          }),
    },
    undefined,
    schema.keepExistingVersions ?? true
  );
}

function moveDependency(host: Tree) {
  return removeDependenciesFromPackageJson(host, ['@nx/react-native'], []);
}

export default expoInitGenerator;
