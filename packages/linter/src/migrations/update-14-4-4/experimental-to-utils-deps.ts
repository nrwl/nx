import {
  addDependenciesToPackageJson,
  formatFiles,
  readJson,
  removeDependenciesFromPackageJson,
  Tree,
} from '@nx/devkit';
import { WORKSPACE_PLUGIN_DIR } from '../../generators/workspace-rules-project/workspace-rules-project';
import { typescriptESLintVersion } from '../../utils/versions';

export default async function addTypescriptEslintUtilsIfNeeded(tree: Tree) {
  try {
    const packageJson = readJson(tree, 'package.json');
    let removed = false;

    if (packageJson.devDependencies['@typescript-eslint/experimental-utils']) {
      await removeDependenciesFromPackageJson(
        tree,
        [],
        ['@typescript-eslint/experimental-utils']
      );
      removed = true;
    }

    if (packageJson.dependencies['@typescript-eslint/experimental-utils']) {
      await removeDependenciesFromPackageJson(
        tree,
        ['@typescript-eslint/experimental-utils'],
        []
      );
      removed = true;
    }

    if (removed || tree.exists(WORKSPACE_PLUGIN_DIR)) {
      addDependenciesToPackageJson(
        tree,
        {},
        { '@typescript-eslint/utils': typescriptESLintVersion }
      );

      await formatFiles(tree);
    }
    return;
  } catch {}
}
