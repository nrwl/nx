import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  GeneratorCallback,
  ProjectGraph,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { addPlugin as _addPlugin } from '@nx/devkit/src/utils/add-plugin';
import { createNodesV2 } from '../../plugins/plugin';
import { cypressVersion, nxVersion } from '../../utils/versions';
import { Schema } from './schema';

function setupE2ETargetDefaults(tree: Tree) {
  const nxJson = readNxJson(tree);

  if (!nxJson.namedInputs) {
    return;
  }

  // E2e targets depend on all their project's sources + production sources of dependencies
  nxJson.targetDefaults ??= {};

  const productionFileSet = !!nxJson.namedInputs?.production;
  nxJson.targetDefaults.e2e ??= {};
  nxJson.targetDefaults.e2e.cache ??= true;
  nxJson.targetDefaults.e2e.inputs ??= [
    'default',
    productionFileSet ? '^production' : '^default',
  ];

  updateNxJson(tree, nxJson);
}

function updateDependencies(tree: Tree, options: Schema) {
  const tasks: GeneratorCallback[] = [];
  tasks.push(removeDependenciesFromPackageJson(tree, ['@nx/cypress'], []));

  tasks.push(
    addDependenciesToPackageJson(
      tree,
      {},
      {
        ['@nx/cypress']: nxVersion,
        cypress: cypressVersion,
      },
      undefined,
      options.keepExistingVersions
    )
  );

  return runTasksInSerial(...tasks);
}

export function addPlugin(
  tree: Tree,
  graph: ProjectGraph,
  updatePackageScripts: boolean
) {
  return _addPlugin(
    tree,
    graph,
    '@nx/cypress/plugin',
    createNodesV2,
    {
      targetName: ['e2e', 'cypress:e2e', 'cypress-e2e'],
      openTargetName: ['open-cypress', 'cypress-open'],
      componentTestingTargetName: [
        'component-test',
        'cypress:component-test',
        'cypress-component-test',
      ],
      ciTargetName: ['e2e-ci', 'cypress:e2e-ci', 'cypress-e2e-ci'],
    },
    updatePackageScripts
  );
}

function updateProductionFileset(tree: Tree) {
  const nxJson = readNxJson(tree);

  const productionFileset = nxJson.namedInputs?.production;
  if (productionFileset) {
    nxJson.namedInputs.production = Array.from(
      new Set([
        ...productionFileset,
        '!{projectRoot}/cypress/**/*',
        '!{projectRoot}/**/*.cy.[jt]s?(x)',
        '!{projectRoot}/cypress.config.[jt]s',
      ])
    );
  }
  updateNxJson(tree, nxJson);
}

export async function cypressInitGenerator(tree: Tree, options: Schema) {
  return cypressInitGeneratorInternal(tree, { addPlugin: false, ...options });
}

export async function cypressInitGeneratorInternal(
  tree: Tree,
  options: Schema
) {
  updateProductionFileset(tree);

  const nxJson = readNxJson(tree);

  options.addPlugin ??=
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  if (options.addPlugin) {
    await addPlugin(
      tree,
      await createProjectGraphAsync(),
      options.updatePackageScripts
    );
  } else {
    setupE2ETargetDefaults(tree);
  }

  let installTask: GeneratorCallback = () => {};
  if (!options.skipPackageJson) {
    installTask = updateDependencies(tree, options);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

export default cypressInitGenerator;
