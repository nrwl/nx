import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  ensurePackage,
  formatFiles,
  GeneratorCallback,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';
import {
  nxVersion,
  tsLibVersion,
  typesNodeVersion,
} from '../../utils/versions';
import { Schema } from './schema';

function updateDependencies(tree: Tree, schema: Schema) {
  removeDependenciesFromPackageJson(tree, ['@nx/web'], []);

  const devDependencies = {
    '@nx/web': nxVersion,
    '@types/node': typesNodeVersion,
  };

  return addDependenciesToPackageJson(
    tree,
    {
      tslib: tsLibVersion,
    },
    devDependencies
  );
}

export async function webInitGenerator(tree: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  const jsInitTask = await jsInitGenerator(tree, {
    js: false,
    skipFormat: true,
  });
  tasks.push(jsInitTask);

  if (!schema.unitTestRunner || schema.unitTestRunner === 'jest') {
    const { jestInitGenerator } = ensurePackage('@nx/jest', nxVersion);
    const jestTask = await jestInitGenerator(tree, {
      skipPackageJson: schema.skipPackageJson,
    });
    tasks.push(jestTask);
  }

  if (!schema.e2eTestRunner || schema.e2eTestRunner === 'cypress') {
    const { cypressInitGenerator } = ensurePackage('@nx/cypress', nxVersion);
    const cypressTask = await cypressInitGenerator(tree, {
      skipPackageJson: schema.skipPackageJson,
    });
    tasks.push(cypressTask);
  } else if (schema.e2eTestRunner === 'playwright') {
    const { initGenerator: playwrightInitGenerator } = ensurePackage<
      typeof import('@nx/playwright')
    >('@nx/playwright', nxVersion);

    const playwrightConfigTask = await playwrightInitGenerator(tree, {
      skipFormat: true,
      skipPackageJson: schema.skipPackageJson,
    });
    tasks.push(playwrightConfigTask);
  }

  if (!schema.skipPackageJson) {
    const installTask = updateDependencies(tree, schema);
    tasks.push(installTask);
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
  return runTasksInSerial(...tasks);
}

export default webInitGenerator;
export const webInitSchematic = convertNxGenerator(webInitGenerator);
