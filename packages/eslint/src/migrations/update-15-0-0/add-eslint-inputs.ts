import {
  formatFiles,
  joinPathFragments,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { getEslintTargets } from '../../generators/utils/eslint-targets';
import { ESLINT_CONFIG_FILENAMES } from '../../utils/config-file';

export default async function addEslintInputs(tree: Tree) {
  const nxJson = readNxJson(tree);

  const globalEslintFile = ESLINT_CONFIG_FILENAMES.find((file) =>
    tree.exists(file)
  );

  if (globalEslintFile && nxJson.namedInputs?.production) {
    const productionFileset = new Set(nxJson.namedInputs.production);

    productionFileset.add(`!{projectRoot}/${globalEslintFile}`);

    nxJson.namedInputs.production = Array.from(productionFileset);
  }

  for (const targetName of getEslintTargets(tree)) {
    nxJson.targetDefaults ??= {};

    const lintTargetDefaults = (nxJson.targetDefaults[targetName] ??= {});

    lintTargetDefaults.inputs ??= [
      'default',
      ...(globalEslintFile
        ? [joinPathFragments('{workspaceRoot}', globalEslintFile)]
        : []),
    ];
  }

  updateNxJson(tree, nxJson);

  await formatFiles(tree);
}
