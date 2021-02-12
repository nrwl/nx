import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  GeneratorCallback,
  setDefaultCollection,
  Tree,
} from '@nrwl/devkit';
import { jestInitGenerator } from '@nrwl/jest';
import { cypressInitGenerator } from '@nrwl/cypress';
import { reactDomVersion, reactInitGenerator, reactVersion } from '@nrwl/react';

import { nextVersion } from '../../utils/versions';
import { InitSchema } from './schema';

function updateDependencies(host: Tree) {
  addDependenciesToPackageJson(
    host,
    {
      next: nextVersion,
      react: reactVersion,
      'react-dom': reactDomVersion,
      tslib: '^2.0.0',
    },
    {}
  );
}

export async function nextInitGenerator(host: Tree, schema: InitSchema) {
  let installTask: GeneratorCallback;

  setDefaultCollection(host, '@nrwl/next');

  if (!schema.unitTestRunner || schema.unitTestRunner === 'jest') {
    installTask = jestInitGenerator(host, {});
  }
  if (!schema.e2eTestRunner || schema.e2eTestRunner === 'cypress') {
    installTask = cypressInitGenerator(host) || installTask;
  }

  await reactInitGenerator(host, schema);

  updateDependencies(host);

  return installTask;
}

export default nextInitGenerator;
export const nextInitSchematic = convertNxGenerator(nextInitGenerator);
