import {
  addDependenciesToPackageJson,
  detectPackageManager,
  formatFiles,
  GeneratorCallback,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { acknowledgeBuildScripts } from '@nx/devkit/internal';
import { nxVersion } from '../../utils/versions';
import { Schema } from './schema';

function updateDependencies(tree: Tree, options: Schema) {
  const tasks: GeneratorCallback[] = [];
  // @nx/node depends on @nx/jest, so jest-resolve is installed even without a
  // jest setup. It depends on unrs-resolver and, from jest 30.5.0, on a
  // jest-haste-map that depends on @parcel/watcher. Neither build is needed:
  // the binding has a fallback and the watcher ships prebuilt.
  acknowledgeBuildScripts(tree, detectPackageManager(tree.root), {
    '@parcel/watcher': false,
    'unrs-resolver': false,
  });
  tasks.push(removeDependenciesFromPackageJson(tree, ['@nx/node'], []));
  tasks.push(
    addDependenciesToPackageJson(
      tree,
      {},
      { '@nx/node': nxVersion },
      undefined,
      options.keepExistingVersions ?? true
    )
  );

  return runTasksInSerial(...tasks);
}

export async function initGenerator(tree: Tree, options: Schema) {
  let installTask: GeneratorCallback = () => {};
  if (!options.skipPackageJson) {
    installTask = updateDependencies(tree, options);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

export default initGenerator;
