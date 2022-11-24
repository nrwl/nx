import { cypressInitGenerator } from '@nrwl/cypress';
import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  GeneratorCallback,
  readWorkspaceConfiguration,
  removeDependenciesFromPackageJson,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { webInitGenerator } from '@nrwl/web';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import {
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
  const workspace = readWorkspaceConfiguration(host);

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

  updateWorkspaceConfiguration(host, { ...workspace, generators });
}

function updateDependencies(host: Tree) {
  removeDependenciesFromPackageJson(host, ['@nrwl/react'], []);

  return addDependenciesToPackageJson(
    host,
    {
      'core-js': '^3.6.5',
      react: reactVersion,
      'react-dom': reactDomVersion,
      'regenerator-runtime': '0.13.7',
      tslib: tsLibVersion,
    },
    {
      '@nrwl/react': nxVersion,
      '@types/node': typesNodeVersion,
      '@types/react': typesReactVersion,
      '@types/react-dom': typesReactDomVersion,
      '@testing-library/react': testingLibraryReactVersion,
      'react-test-renderer': reactTestRendererVersion,
    }
  );
}

export async function reactInitGenerator(host: Tree, schema: InitSchema) {
  const tasks: GeneratorCallback[] = [];

  setDefault(host);

  if (!schema.e2eTestRunner || schema.e2eTestRunner === 'cypress') {
    const cypressTask = cypressInitGenerator(host, {});
    tasks.push(cypressTask);
  }

  const initTask = await webInitGenerator(host, schema);
  tasks.push(initTask);
  if (!schema.skipPackageJson) {
    const installTask = updateDependencies(host);
    tasks.push(installTask);
  }

  return runTasksInSerial(...tasks);
}

export default reactInitGenerator;

export const reactInitSchematic = convertNxGenerator(reactInitGenerator);
