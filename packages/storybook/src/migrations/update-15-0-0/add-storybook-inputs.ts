import { formatFiles, readNxJson, Tree, updateNxJson } from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';

export default async function (tree: Tree) {
  const nxJson = readNxJson(tree);

  const storybookTargets = getStorybookBuildTargets(tree);
  const hasProductionFileset = !!nxJson.namedInputs?.production;

  if (storybookTargets.size > 0 && hasProductionFileset) {
    const productionFileset = new Set(nxJson.namedInputs.production);
    for (const exclusion of [
      '!{projectRoot}/.storybook/**/*',
      '!{projectRoot}/**/*.stories.@(js|jsx|ts|tsx|mdx)',
    ]) {
      productionFileset.add(exclusion);
    }
    nxJson.namedInputs.production = Array.from(productionFileset);
  }

  for (const targetName of storybookTargets) {
    nxJson.targetDefaults ??= {};
    const storybookTargetDefaults = (nxJson.targetDefaults[targetName] ??= {});

    storybookTargetDefaults.inputs ??= [
      'default',
      hasProductionFileset ? '^production' : '^default',
      ...(tree.exists('.storybook') ? ['{workspaceRoot}/.storybook/**/*'] : []),
    ];
  }

  updateNxJson(tree, nxJson);

  await formatFiles(tree);
}

function getStorybookBuildTargets(tree: Tree) {
  const storybookBuildTargets = new Set<string>();
  forEachExecutorOptions(tree, '@nrwl/storybook:build', (_, __, target) => {
    storybookBuildTargets.add(target);
  });
  forEachExecutorOptions(
    tree,
    '@storybook/angular:build-storybook',
    (_, __, target) => {
      storybookBuildTargets.add(target);
    }
  );
  return storybookBuildTargets;
}
