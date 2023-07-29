import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  ensurePackage,
  GeneratorCallback,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';

import { reactDomVersion, reactVersion } from '@nx/react/src/utils/versions';
import reactInitGenerator from '@nx/react/src/generators/init/init';
import { initGenerator as jsInitGenerator } from '@nx/js';

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
      next: nextVersion,
      react: reactVersion,
      'react-dom': reactDomVersion,
      tslib: tsLibVersion,
    },
    {
      '@nx/next': nxVersion,
      'eslint-config-next': eslintConfigNextVersion,
    }
  );
}

export async function nextInitGenerator(host: Tree, schema: InitSchema) {
  const tasks: GeneratorCallback[] = [];

  tasks.push(
    await jsInitGenerator(host, {
      ...schema,
      skipFormat: true,
    })
  );

  if (!schema.unitTestRunner || schema.unitTestRunner === 'jest') {
    const { jestInitGenerator } = ensurePackage<typeof import('@nx/jest')>(
      '@nx/jest',
      nxVersion
    );
    const jestTask = await jestInitGenerator(host, schema);
    tasks.push(jestTask);
  }
  if (!schema.e2eTestRunner || schema.e2eTestRunner === 'cypress') {
    const { cypressInitGenerator } = ensurePackage<
      typeof import('@nx/cypress')
    >('@nx/cypress', nxVersion);
    const cypressTask = await cypressInitGenerator(host, {});
    tasks.push(cypressTask);
  }

  const reactTask = await reactInitGenerator(host, {
    ...schema,
    skipFormat: true,
  });
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
