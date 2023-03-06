import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  ensurePackage,
  GeneratorCallback,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
  writeJson,
} from '@nrwl/devkit';

import { initGenerator as jsInitGenerator } from '@nrwl/js';
import {
  babelPresetReactVersion,
  nxVersion,
  reactDomVersion,
  reactTestRendererVersion,
  reactVersion,
  testingLibraryReactVersion,
  tsLibVersion,
  typesNodeVersion,
  typesReactDomVersion,
  typesReactVersion,
} from '../../utils/versions';
import { InitSchema } from './schema';

function setDefault(host: Tree) {
  const workspace = readNxJson(host);

  workspace.generators = workspace.generators || {};
  const reactGenerators = workspace.generators['@nrwl/react'] || {};
  const generators = {
    ...workspace.generators,
    '@nrwl/react': {
      ...reactGenerators,
      application: {
        ...reactGenerators.application,
        babel: true,
      },
    },
  };

  updateNxJson(host, { ...workspace, generators });
}

function updateDependencies(host: Tree, schema: InitSchema) {
  removeDependenciesFromPackageJson(host, ['@nrwl/react'], []);

  const dependencies = {
    react: reactVersion,
    'react-dom': reactDomVersion,
  };

  if (!schema.skipHelperLibs) {
    dependencies['tslib'] = tsLibVersion;
  }

  return addDependenciesToPackageJson(host, dependencies, {
    '@nrwl/react': nxVersion,
    '@types/node': typesNodeVersion,
    '@types/react': typesReactVersion,
    '@types/react-dom': typesReactDomVersion,
    '@testing-library/react': testingLibraryReactVersion,
    'react-test-renderer': reactTestRendererVersion,
  });
}

function initRootBabelConfig(tree: Tree, schema: InitSchema) {
  if (tree.exists('/babel.config.json') || tree.exists('/babel.config.js')) {
    return;
  }

  if (!schema.skipBabelConfig) {
    writeJson(tree, '/babel.config.json', {
      babelrcRoots: ['*'], // Make sure .babelrc files other than root can be loaded in a monorepo
    });
  }

  const nxJson = readNxJson(tree);

  if (nxJson.namedInputs?.sharedGlobals) {
    nxJson.namedInputs.sharedGlobals.push('{workspaceRoot}/babel.config.json');
  }
  updateNxJson(tree, nxJson);
}

export async function reactInitGenerator(host: Tree, schema: InitSchema) {
  const tasks: GeneratorCallback[] = [];

  const jsInitTask = await jsInitGenerator(host, {
    ...schema,
    tsConfigName: schema.rootProject ? 'tsconfig.json' : 'tsconfig.base.json',
    skipFormat: true,
  });

  tasks.push(jsInitTask);

  setDefault(host);

  if (!schema.e2eTestRunner || schema.e2eTestRunner === 'cypress') {
    ensurePackage('@nrwl/cypress', nxVersion);
    const { cypressInitGenerator } = await import(
      '@nrwl/cypress/src/generators/init/init'
    );
    const cypressTask = await cypressInitGenerator(host, {});
    tasks.push(cypressTask);
  }

  if (!schema.skipPackageJson && !schema.skipBabelConfig) {
    const installBabelTask = addDependenciesToPackageJson(
      host,
      {},
      {
        '@babel/preset-react': babelPresetReactVersion,
      }
    );
    tasks.push(installBabelTask);
  }

  if (!schema.skipBabelConfig) {
    initRootBabelConfig(host, schema);
  }

  if (!schema.skipPackageJson) {
    const installTask = updateDependencies(host, schema);
    tasks.push(installTask);
  }

  return runTasksInSerial(...tasks);
}

export default reactInitGenerator;

export const reactInitSchematic = convertNxGenerator(reactInitGenerator);
