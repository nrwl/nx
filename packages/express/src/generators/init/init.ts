import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { assertSupportedExpressVersion } from '../../utils/assert-supported-express-version';
import { nxVersion, versions } from '../../utils/versions';
import type { Schema } from './schema';

function updateDependencies(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  tasks.push(removeDependenciesFromPackageJson(tree, ['@nx/express'], []));

  const pkgVersions = versions(tree);
  tasks.push(
    addDependenciesToPackageJson(
      tree,
      { express: pkgVersions.expressVersion },
      {
        '@nx/express': nxVersion,
        '@types/express': pkgVersions.expressTypingsVersion,
      },
      undefined,
      schema.keepExistingVersions ?? true
    )
  );

  return runTasksInSerial(...tasks);
}

export async function initGenerator(tree: Tree, schema: Schema) {
  assertSupportedExpressVersion(tree);

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
