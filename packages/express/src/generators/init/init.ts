import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { expressVersion, nxVersion } from '../../utils/versions';
import type { Schema } from './schema';

function updateDependencies(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  tasks.push(removeDependenciesFromPackageJson(tree, ['@nx/express'], []));

  tasks.push(
    addDependenciesToPackageJson(
      tree,
      { express: expressVersion },
      { '@nx/express': nxVersion },
      undefined,
      schema.keepExistingVersions
    )
  );

  return runTasksInSerial(...tasks);
}

export async function initGenerator(tree: Tree, schema: Schema) {
  let installTask: GeneratorCallback = () => {};
  if (!schema.skipPackageJson) {
    installTask = updateDependencies(tree, schema);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

export default initGenerator;
