import {
  formatFiles,
  joinPathFragments,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { eslintConfigFileWhitelist } from '../../generators/utils/eslint-file';

export default async function addEslintInputs(tree: Tree) {
  const workspaceConfiguration = readWorkspaceConfiguration(tree);

  const globalEslintFile = eslintConfigFileWhitelist.find((file) =>
    tree.exists(file)
  );

  if (globalEslintFile && workspaceConfiguration.namedInputs?.production) {
    const productionFileset = new Set(
      workspaceConfiguration.namedInputs.production
    );

    productionFileset.add(`!{projectRoot}/${globalEslintFile}`);

    workspaceConfiguration.namedInputs.production =
      Array.from(productionFileset);
  }

  for (const targetName of getEslintTargets(tree)) {
    workspaceConfiguration.targetDefaults ??= {};

    const lintTargetDefaults = (workspaceConfiguration.targetDefaults[
      targetName
    ] ??= {});

    lintTargetDefaults.inputs ??= [
      'default',
      ...(globalEslintFile
        ? [joinPathFragments('{workspaceRoot}', globalEslintFile)]
        : []),
    ];
  }

  updateWorkspaceConfiguration(tree, workspaceConfiguration);

  await formatFiles(tree);
}

function getEslintTargets(tree: Tree) {
  const eslintTargetNames = new Set<string>();
  forEachExecutorOptions(tree, '@nrwl/linter:eslint', (_, __, target) => {
    eslintTargetNames.add(target);
  });
  return eslintTargetNames;
}
