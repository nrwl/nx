import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';
import { Schema } from './schema';

function updateDependencies(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];
  tasks.push(removeDependenciesFromPackageJson(tree, ['@nx/web'], []));
  tasks.push(
    addDependenciesToPackageJson(
      tree,
      {},
      { '@nx/web': nxVersion },
      undefined,
      schema.keepExistingVersions
    )
  );

  return runTasksInSerial(...tasks);
}

export async function webInitGenerator(tree: Tree, schema: Schema) {
  let installTask: GeneratorCallback = () => {};
  if (!schema.skipPackageJson) {
    installTask = updateDependencies(tree, schema);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

export default webInitGenerator;
