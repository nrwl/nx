import { addDependenciesToPackageJson, formatFiles, Tree } from '@nrwl/devkit';
import { swcCoreVersion, swcNodeVersion } from 'nx/src/utils/versions';
import { WORKSPACE_PLUGIN_DIR } from '../../generators/workspace-rules-project/workspace-rules-project';

export default async function addSwcNodeIfNeeded(tree: Tree) {
  try {
    if (tree.exists(WORKSPACE_PLUGIN_DIR)) {
      addDependenciesToPackageJson(
        tree,
        {},
        { '@swc-node/register': swcNodeVersion, '@swc/core': swcCoreVersion }
      );
      await formatFiles(tree);
      return;
    }
  } catch {}
}
