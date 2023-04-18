import { formatFiles, Tree } from '@nx/devkit';
import { addSwcRegisterDependencies } from '@nx/js/src/utils/swc/add-swc-dependencies';
import { WORKSPACE_PLUGIN_DIR } from '../../generators/workspace-rules-project/workspace-rules-project';

export default async function addSwcNodeIfNeeded(tree: Tree) {
  try {
    if (tree.exists(WORKSPACE_PLUGIN_DIR)) {
      addSwcRegisterDependencies(tree);
      await formatFiles(tree);
      return;
    }
  } catch {}
}
