import { formatFiles, readNxJson, Tree, updateNxJson } from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { CypressExecutorOptions } from '../../executors/cypress/cypress.impl';

export default async function (tree: Tree) {
  const nxJson = readNxJson(tree);

  const { cypressTargets, hasComponentTesting } = getCypressTargetNames(tree);
  const hasProductionFileset = !!nxJson.namedInputs?.production;

  if (hasComponentTesting && hasProductionFileset && cypressTargets.size > 0) {
    const productionFileset = new Set(nxJson.namedInputs.production);
    for (const exclusion of [
      '!{projectRoot}/cypress/**/*',
      '!{projectRoot}/**/*.cy.[jt]s?(x)',
      '!{projectRoot}/cypress.config.[jt]s',
    ]) {
      productionFileset.add(exclusion);
    }
    nxJson.namedInputs.production = Array.from(productionFileset);
  }

  for (const targetName of cypressTargets) {
    nxJson.targetDefaults ??= {};
    const cypressTargetDefaults = (nxJson.targetDefaults[targetName] ??= {});

    cypressTargetDefaults.inputs ??= [
      'default',
      hasProductionFileset ? '^production' : '^default',
    ];
  }

  updateNxJson(tree, nxJson);

  await formatFiles(tree);
}

function getCypressTargetNames(tree: Tree) {
  const cypressTargets = new Set<string>();
  let hasComponentTesting = false;
  forEachExecutorOptions<CypressExecutorOptions>(
    tree,
    '@nrwl/cypress:cypress',
    (options, __, target) => {
      cypressTargets.add(target);
      if (options.testingType === 'component') {
        hasComponentTesting = true;
      }
    }
  );
  return { cypressTargets, hasComponentTesting };
}
