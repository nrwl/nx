import {
  formatFiles,
  joinPathFragments,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { eslintConfigFileWhitelist } from '../../generators/utils/eslint-file';
import { getEslintTargets } from '../../generators/utils/eslint-targets';

export default async function addEslintInputs(tree: Tree) {
  const nxJson = readNxJson(tree);

  const globalEslintFile = eslintConfigFileWhitelist.find((file) =>
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
