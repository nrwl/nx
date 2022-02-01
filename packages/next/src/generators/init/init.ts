import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  GeneratorCallback,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { setDefaultCollection } from '@nrwl/workspace/src/utilities/set-default-collection';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { jestInitGenerator } from '@nrwl/jest';
import { cypressInitGenerator } from '@nrwl/cypress';
import { reactDomVersion, reactInitGenerator, reactVersion } from '@nrwl/react';

import {
  eslintConfigNextVersion,
  nextVersion,
  nxVersion,
} from '../../utils/versions';
import { InitSchema } from './schema';

function updateDependencies(host: Tree) {
  return addDependenciesToPackageJson(
    host,
    {
      '@nrwl/next': nxVersion,
      next: nextVersion,
      react: reactVersion,
      'react-dom': reactDomVersion,
      tslib: '^2.0.0',
    },
    {
      'eslint-config-next': eslintConfigNextVersion,
    }
  );
}

export async function nextInitGenerator(host: Tree, schema: InitSchema) {
  const tasks: GeneratorCallback[] = [];

  setDefaultCollection(host, '@nrwl/next');

  if (!schema.unitTestRunner || schema.unitTestRunner === 'jest') {
    const jestTask = jestInitGenerator(host, {});
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

  return runTasksInSerial(...tasks);
}

export default nextInitGenerator;
export const nextInitSchematic = convertNxGenerator(nextInitGenerator);
