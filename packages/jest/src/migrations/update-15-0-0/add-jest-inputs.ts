import { formatFiles, readNxJson, Tree, updateNxJson } from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';

export default async function (tree: Tree) {
  const nxJson = readNxJson(tree);

  const jestTargets = getJestTargetNames(tree);
  const hasProductionFileset = !!nxJson.namedInputs?.production;

  if (jestTargets.size > 0 && hasProductionFileset) {
    const productionFileset = new Set(nxJson.namedInputs.production);
    for (const exclusion of [
      '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
      '!{projectRoot}/tsconfig.spec.json',
      '!{projectRoot}/jest.config.[jt]s',
    ]) {
      productionFileset.add(exclusion);
    }
    nxJson.namedInputs.production = Array.from(productionFileset);
  }

  for (const targetName of jestTargets) {
    nxJson.targetDefaults ??= {};
    const jestTargetDefaults = (nxJson.targetDefaults[targetName] ??= {});

    jestTargetDefaults.inputs ??= [
      'default',
      hasProductionFileset ? '^production' : '^default',
      ...(tree.exists('jest.preset.js')
        ? ['{workspaceRoot}/jest.preset.js']
        : []),
    ];
  }

  updateNxJson(tree, nxJson);

  await formatFiles(tree);
}

function getJestTargetNames(tree: Tree) {
  const jestTargetNames = new Set<string>();
  forEachExecutorOptions(tree, '@nrwl/jest:jest', (_, __, target) => {
    jestTargetNames.add(target);
  });
  return jestTargetNames;
}
