import {
  acknowledgeBuildScripts,
  addPlugin as _addPlugin,
} from '@nx/devkit/internal';
import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  detectPackageManager,
  formatFiles,
  GeneratorCallback,
  ProjectGraph,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { createNodesV2 } from '../../plugins/plugin';
import { assertSupportedCypressVersion } from '../../utils/assert-supported-cypress-version';
import {
  cypressVersion,
  getInstalledCypressVersion,
  nxVersion,
} from '../../utils/versions';
import { Schema } from './schema';

function updateDependencies(tree: Tree, options: Schema) {
  const tasks: GeneratorCallback[] = [];
  tasks.push(removeDependenciesFromPackageJson(tree, ['@nx/cypress'], []));

  const devDependencies: Record<string, string> = {
    ['@nx/cypress']: nxVersion,
  };
  if (!getInstalledCypressVersion(tree)) {
    devDependencies.cypress = cypressVersion;
    // The user explicitly asked for cypress, and its postinstall downloads
    // the binary it needs to run at all, so enable it — npm and yarn run it
    // unconditionally. Transitive deps stay denied.
    acknowledgeBuildScripts(tree, detectPackageManager(tree.root), {
      cypress: true,
    });
  }

  tasks.push(
    addDependenciesToPackageJson(
      tree,
      {},
      devDependencies,
      undefined,
      options.keepExistingVersions ?? true
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
  assertSupportedCypressVersion(tree);

  updateProductionFileset(tree);

  await addPlugin(
    tree,
    await createProjectGraphAsync(),
    options.updatePackageScripts
  );

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
