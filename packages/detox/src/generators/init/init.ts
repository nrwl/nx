import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  removeDependenciesFromPackageJson,
  Tree,
} from '@nrwl/devkit';
import { jestVersion } from '@nrwl/jest/src/utils/versions';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { Schema } from './schema';
import {
  detoxVersion,
  nxVersion,
  testingLibraryJestDom,
} from '../../utils/versions';

export async function detoxInitGenerator(host: Tree, schema: Schema) {
  const tasks = [moveDependency(host), updateDependencies(host)];

  if (!schema.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export function updateDependencies(host: Tree) {
  return addDependenciesToPackageJson(
    host,
    {},
    {
      '@nrwl/detox': nxVersion,
      detox: detoxVersion,
      '@testing-library/jest-dom': testingLibraryJestDom,
      'jest-circus': jestVersion,
    }
  );
}

function moveDependency(host: Tree) {
  return removeDependenciesFromPackageJson(host, ['@nrwl/detox'], []);
}

export default detoxInitGenerator;
export const detoxInitSchematic = convertNxGenerator(detoxInitGenerator);
