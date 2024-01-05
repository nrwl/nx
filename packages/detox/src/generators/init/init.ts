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
import { jestVersion, typesNodeVersion } from '@nx/jest/src/utils/versions';

import { Schema } from './schema';
import {
  configPluginsDetoxVersion,
  detoxVersion,
  nxVersion,
  testingLibraryJestDom,
} from '../../utils/versions';
import { DetoxPluginOptions } from '../../plugins/plugin';

export async function detoxInitGenerator(host: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  if (!schema.skipPackageJson) {
    tasks.push(moveDependency(host));
    tasks.push(updateDependencies(host, schema));
  }

  if (process.env.NX_PCV3 === 'true') {
    addPlugin(host);
  }

  if (!schema.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export function updateDependencies(host: Tree, schema: Schema) {
  return addDependenciesToPackageJson(
    host,
    {},
    {
      '@nx/detox': nxVersion,
      detox: detoxVersion,
      '@testing-library/jest-dom': testingLibraryJestDom,
      '@types/node': typesNodeVersion,
      'jest-circus': jestVersion,
      ...(schema.framework === 'expo'
        ? { '@config-plugins/detox': configPluginsDetoxVersion }
        : {}),
    }
  );
}

function moveDependency(host: Tree) {
  return removeDependenciesFromPackageJson(host, ['@nx/detox'], []);
}

function addPlugin(host: Tree) {
  const nxJson = readNxJson(host);
  nxJson.plugins ??= [];

  for (const plugin of nxJson.plugins) {
    if (
      typeof plugin === 'string'
        ? plugin === '@nx/detox/plugin'
        : plugin.plugin === '@nx/detox/plugin'
    ) {
      return;
    }
  }

  nxJson.plugins.push({
    plugin: '@nx/detox/plugin',
    options: {
      buildTargetName: 'build',
      testTargetName: 'test',
    } as DetoxPluginOptions,
  });
  updateNxJson(host, nxJson);
}

export default detoxInitGenerator;
