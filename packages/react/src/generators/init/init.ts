import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  ensurePackage,
  GeneratorCallback,
  readJson,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
} from '@nx/devkit';

import { initGenerator as jsInitGenerator } from '@nx/js';
import {
  nxVersion,
  reactDomVersion,
  reactVersion,
  testingLibraryReactVersion,
  tsLibVersion,
  typesNodeVersion,
  typesReactDomVersion,
  typesReactVersion,
} from '../../utils/versions';
import { InitSchema } from './schema';

function setDefault(host: Tree, schema: InitSchema) {
  const workspace = readNxJson(host);

  workspace.generators ??= {};
  const reactGenerators = workspace.generators['@nx/react'] || {};
  const generators: typeof reactGenerators = {
    ...workspace.generators,
    '@nx/react': {
      ...reactGenerators,
      application: {
        ...reactGenerators.application,
        babel: true,
      },
    },
  };

  if (schema.projectNameAndRootFormat === 'as-provided') {
    const { dependencies, devDependencies } = readJson(host, 'package.json');
    const isFirstRun = !dependencies?.['react'] && !devDependencies['react'];
    if (isFirstRun) {
      generators['@nx/react'].application.projectNameAndRootFormat =
        'as-provided';
      generators['@nx/react'].library ??= {};
      generators['@nx/react'].library.projectNameAndRootFormat = 'as-provided';
      generators['@nx/react'].host ??= {};
      generators['@nx/react'].host.projectNameAndRootFormat = 'as-provided';
      generators['@nx/react'].remote ??= {};
      generators['@nx/react'].remote.projectNameAndRootFormat = 'as-provided';
    }
  }

  updateNxJson(host, { ...workspace, generators });
}

function updateDependencies(host: Tree, schema: InitSchema) {
  removeDependenciesFromPackageJson(host, ['@nx/react'], []);

  const dependencies = {
    react: reactVersion,
    'react-dom': reactDomVersion,
  };

  if (!schema.skipHelperLibs) {
    dependencies['tslib'] = tsLibVersion;
  }

  return addDependenciesToPackageJson(host, dependencies, {
    '@nx/react': nxVersion,
    '@types/node': typesNodeVersion,
    '@types/react': typesReactVersion,
    '@types/react-dom': typesReactDomVersion,
    '@testing-library/react': testingLibraryReactVersion,
  });
}

export async function reactInitGenerator(host: Tree, schema: InitSchema) {
  const tasks: GeneratorCallback[] = [];

  const jsInitTask = await jsInitGenerator(host, {
    ...schema,
    tsConfigName: schema.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
    skipFormat: true,
  });

  tasks.push(jsInitTask);

  setDefault(host, schema);

  if (!schema.e2eTestRunner || schema.e2eTestRunner === 'cypress') {
    ensurePackage('@nx/cypress', nxVersion);
    const { cypressInitGenerator } = await import(
      '@nx/cypress/src/generators/init/init'
    );
    const cypressTask = await cypressInitGenerator(host, {
      projectNameAndRootFormat: schema.projectNameAndRootFormat,
    });
    tasks.push(cypressTask);
  }

  if (!schema.skipPackageJson) {
    const installTask = updateDependencies(host, schema);
    tasks.push(installTask);
  }

  return runTasksInSerial(...tasks);
}

export default reactInitGenerator;

export const reactInitSchematic = convertNxGenerator(reactInitGenerator);
