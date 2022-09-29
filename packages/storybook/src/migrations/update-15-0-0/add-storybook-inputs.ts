import {
  formatFiles,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';

export default async function (tree: Tree) {
  const workspaceConfiguration = readWorkspaceConfiguration(tree);

  const storybookTargets = getStorybookBuildTargets(tree);
  const hasProductionFileset = !!workspaceConfiguration.namedInputs?.production;

  if (storybookTargets.size > 0 && hasProductionFileset) {
    const productionFileset = new Set(
      workspaceConfiguration.namedInputs.production
    );
    for (const exclusion of [
      '!{projectRoot}/.storybook/**/*',
      '!{projectRoot}/**/*.stories.@(js|jsx|ts|tsx|mdx)',
    ]) {
      productionFileset.add(exclusion);
    }
    workspaceConfiguration.namedInputs.production =
      Array.from(productionFileset);
  }

  for (const targetName of storybookTargets) {
    workspaceConfiguration.targetDefaults ??= {};
    const storybookTargetDefaults = (workspaceConfiguration.targetDefaults[
      targetName
    ] ??= {});

    storybookTargetDefaults.inputs ??= [
      'default',
      hasProductionFileset ? '^production' : '^default',
      ...(tree.exists('.storybook') ? ['{workspaceRoot}/.storybook/**/*'] : []),
    ];
  }

  updateWorkspaceConfiguration(tree, workspaceConfiguration);

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
