import {
  formatFiles,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';

export default async function (tree: Tree) {
  const workspaceConfiguration = readWorkspaceConfiguration(tree);

  const jestTargets = getJestTargetNames(tree);
  const hasProductionFileset = !!workspaceConfiguration.namedInputs?.production;

  if (jestTargets.size > 0 && hasProductionFileset) {
    const productionFileset = new Set(
      workspaceConfiguration.namedInputs.production
    );
    for (const exclusion of [
      '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
      '!{projectRoot}/tsconfig.spec.json',
      '!{projectRoot}/jest.config.[jt]s',
    ]) {
      productionFileset.add(exclusion);
    }
    workspaceConfiguration.namedInputs.production =
      Array.from(productionFileset);
  }

  for (const targetName of jestTargets) {
    workspaceConfiguration.targetDefaults ??= {};
    const jestTargetDefaults = (workspaceConfiguration.targetDefaults[
      targetName
    ] ??= {});

    jestTargetDefaults.inputs ??= [
      'default',
      hasProductionFileset ? '^production' : '^default',
      ...(tree.exists('jest.preset.js')
        ? ['{workspaceRoot}/jest.preset.js']
        : []),
    ];
  }

  updateWorkspaceConfiguration(tree, workspaceConfiguration);

  await formatFiles(tree);
}

function getJestTargetNames(tree: Tree) {
  const jestTargetNames = new Set<string>();
  forEachExecutorOptions(tree, '@nrwl/jest:jest', (_, __, target) => {
    jestTargetNames.add(target);
  });
  return jestTargetNames;
}
