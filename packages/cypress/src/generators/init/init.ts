import {
  addPlugin as _addPlugin,
  upsertTargetDefault,
} from '@nx/devkit/internal';
import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  GeneratorCallback,
  ProjectGraph,
  readNxJson,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  type TargetConfiguration,
  type TargetDefaults,
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

function setupE2ETargetDefaults(tree: Tree) {
  const nxJson = readNxJson(tree);

  if (!nxJson.namedInputs) {
    return;
  }

  // E2e targets depend on all their project's sources + production sources of dependencies
  const productionFileSet = !!nxJson.namedInputs?.production;
  const existing = findExistingE2eDefault(nxJson.targetDefaults);
  const patch: Partial<TargetConfiguration> = {};
  if (existing?.cache === undefined) patch.cache = true;
  if (existing?.inputs === undefined) {
    patch.inputs = ['default', productionFileSet ? '^production' : '^default'];
  }
  if (Object.keys(patch).length > 0) {
    upsertTargetDefault(tree, nxJson, { target: 'e2e', ...patch });
    updateNxJson(tree, nxJson);
  }
}

function findExistingE2eDefault(
  td: TargetDefaults | undefined
): Partial<TargetConfiguration> | undefined {
  if (!td) return undefined;
  if (Array.isArray(td)) {
    return td.find(
      (e) =>
        e.target === 'e2e' && e.projects === undefined && e.plugin === undefined
    );
  }
  return td['e2e'];
}

function updateDependencies(tree: Tree, options: Schema) {
  const tasks: GeneratorCallback[] = [];
  tasks.push(removeDependenciesFromPackageJson(tree, ['@nx/cypress'], []));

  const devDependencies: Record<string, string> = {
    ['@nx/cypress']: nxVersion,
  };
  if (!getInstalledCypressVersion(tree)) {
    devDependencies.cypress = cypressVersion;
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
