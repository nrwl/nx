import {
  addDependenciesToPackageJson,
  formatFiles,
  readJson,
  removeDependenciesFromPackageJson,
  Tree,
} from '@nrwl/devkit';
import { WORKSPACE_PLUGIN_DIR } from '../../generators/workspace-rules-project/workspace-rules-project';
import { typescriptESLintVersion } from '../../utils/versions';

export default async function addTypescriptEslintUtilsIfNeeded(tree: Tree) {
  try {
    if (tree.exists(WORKSPACE_PLUGIN_DIR)) {
      const packageJson = readJson(tree, 'package.json');

      if (packageJson.devDependencies['node-sass']) {
        await removeDependenciesFromPackageJson(
          tree,
          [],
          ['@typescript-eslint/experimental-utils']
        );
      }

      addDependenciesToPackageJson(
        tree,
        {},
        { '@typescript-eslint/utils': typescriptESLintVersion }
      );

      await formatFiles(tree);
      return;
    }
  } catch {}
}
