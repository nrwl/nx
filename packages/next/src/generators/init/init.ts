import {
  addDependenciesToPackageJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { reactDomVersion, reactVersion } from '@nx/react/src/utils/versions';
import { addGitIgnoreEntry } from '../../utils/add-gitignore-entry';
import { nextVersion, nxVersion } from '../../utils/versions';
import { addPlugin } from './lib/add-plugin';
import type { InitSchema } from './schema';

function updateDependencies(host: Tree, schema: InitSchema) {
  const tasks: GeneratorCallback[] = [];

  tasks.push(removeDependenciesFromPackageJson(host, ['@nx/next'], []));

  tasks.push(
    addDependenciesToPackageJson(
      host,
      {
        next: nextVersion,
        react: reactVersion,
        'react-dom': reactDomVersion,
      },
      {
        '@nx/next': nxVersion,
      }
    )
  );

  return runTasksInSerial(...tasks);
}

export async function nextInitGenerator(host: Tree, schema: InitSchema) {
  if (process.env.NX_PCV3 === 'true') {
    addPlugin(host);
  }

  addGitIgnoreEntry(host);

  let installTask: GeneratorCallback = () => {};
  if (!schema.skipPackageJson) {
    installTask = updateDependencies(host, schema);
  }

  return installTask;
}

export default nextInitGenerator;
