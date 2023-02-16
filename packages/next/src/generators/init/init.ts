import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  GeneratorCallback,
  Tree,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { jestInitGenerator } from '@nrwl/jest';
import { cypressInitGenerator } from '@nrwl/cypress';
import { reactDomVersion, reactVersion } from '@nrwl/react/src/utils/versions';
import reactInitGenerator from '@nrwl/react/src/generators/init/init';
import { initGenerator as jsInitGenerator } from '@nrwl/js';

import {
  eslintConfigNextVersion,
  nextVersion,
  nxVersion,
  tsLibVersion,
} from '../../utils/versions';
import { InitSchema } from './schema';
import { addGitIgnoreEntry } from '../../utils/add-gitignore-entry';

function updateDependencies(host: Tree) {
  return addDependenciesToPackageJson(
    host,
    {
      '@nrwl/next': nxVersion,
      next: nextVersion,
      react: reactVersion,
      'react-dom': reactDomVersion,
      tslib: tsLibVersion,
    },
    {
      'eslint-config-next': eslintConfigNextVersion,
    }
  );
}

export async function nextInitGenerator(host: Tree, schema: InitSchema) {
  await jsInitGenerator(host, {
    js: schema.js,
    skipFormat: true,
  });
  const tasks: GeneratorCallback[] = [];

  if (!schema.unitTestRunner || schema.unitTestRunner === 'jest') {
    const jestTask = await jestInitGenerator(host, schema);
    tasks.push(jestTask);
  }
  if (!schema.e2eTestRunner || schema.e2eTestRunner === 'cypress') {
    const cypressTask = cypressInitGenerator(host, {});
    tasks.push(cypressTask);
  }

  const reactTask = await reactInitGenerator(host, schema);
  tasks.push(reactTask);

  const installTask = updateDependencies(host);
  tasks.push(installTask);

  addGitIgnoreEntry(host);

  return runTasksInSerial(...tasks);
}

export default nextInitGenerator;
export const nextInitSchematic = convertNxGenerator(nextInitGenerator);
