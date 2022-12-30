import {
  formatFiles,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { CypressExecutorOptions } from '@nrwl/cypress/src/executors/cypress/cypress.impl';

export default async function (tree: Tree) {
  const workspaceConfiguration = readWorkspaceConfiguration(tree);

  const { cypressTargets, hasComponentTesting } = getCypressTargetNames(tree);
  const hasProductionFileset = !!workspaceConfiguration.namedInputs?.production;

  if (hasComponentTesting && hasProductionFileset && cypressTargets.size > 0) {
    const productionFileset = new Set(
      workspaceConfiguration.namedInputs.production
    );
    for (const exclusion of [
      '!{projectRoot}/cypress/**/*',
      '!{projectRoot}/**/*.cy.[jt]s?(x)',
      '!{projectRoot}/cypress.config.[jt]s',
    ]) {
      productionFileset.add(exclusion);
    }
    workspaceConfiguration.namedInputs.production =
      Array.from(productionFileset);
  }

  for (const targetName of cypressTargets) {
    workspaceConfiguration.targetDefaults ??= {};
    const cypressTargetDefaults = (workspaceConfiguration.targetDefaults[
      targetName
    ] ??= {});

    cypressTargetDefaults.inputs ??= [
      'default',
      hasProductionFileset ? '^production' : '^default',
    ];
  }

  updateWorkspaceConfiguration(tree, workspaceConfiguration);

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
