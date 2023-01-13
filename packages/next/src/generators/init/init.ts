import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  GeneratorCallback,
  Tree,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { jestInitGenerator } from '@nrwl/jest';
import { cypressInitGenerator } from '@nrwl/cypress';
import { reactDomVersion, reactInitGenerator, reactVersion } from '@nrwl/react';

import {
  eslintConfigNextVersion,
  nextVersion,
  nxVersion,
  tsLibVersion,
} from '../../utils/versions';
import { InitSchema } from './schema';
import { addGitIgnoreEntry } from '../../utils/add-gitignore-entry';
import { jsInitGenerator } from '@nrwl/js';

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
  const tasks: GeneratorCallback[] = [
    jsInitGenerator(host, {
      skipPackageJson: schema.skipPackageJson,
      skipTsConfig: schema.skipTsConfig,
    }),
  ];

  if (!schema.unitTestRunner || schema.unitTestRunner === 'jest') {
    const jestTask = jestInitGenerator(host, schema);
    tasks.push(jestTask);
  }
  if (!schema.e2eTestRunner || schema.e2eTestRunner === 'cypress') {
    const cypressTask = cypressInitGenerator(host, {});
    tasks.push(cypressTask);
  }

  const reactTask = await reactInitGenerator(host, schema);
  tasks.push(reactTask);

  if (!schema.skipPackageJson) {
    const installTask = updateDependencies(host);
    tasks.push(installTask);
  }

  addGitIgnoreEntry(host);

  return runTasksInSerial(...tasks);
}

export default nextInitGenerator;
export const nextInitSchematic = convertNxGenerator(nextInitGenerator);
