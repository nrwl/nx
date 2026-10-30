import { formatFiles, type Tree } from '@nx/devkit';
import { BUN_INSTALL_SETTINGS_INPUTS } from '../../utils/bun-install-settings-inputs';
import { addDeployOutputCacheInputsToBuildTargets } from '../../utils/deploy-output-cache-inputs';

/**
 * Adds the root package.json fields a pruned Bun deploy output is built from
 * to the `inputs` of build targets that emit it. The trust list reaches no
 * package's hash, so without them an untrusted package leaves the task hash
 * unchanged and a cached run replays an output that still trusts it.
 */
export default async function update(tree: Tree) {
  // On the binary bun.lockb the deploy output is the manifest alone.
  if (!tree.exists('bun.lock')) {
    return;
  }
  await addDeployOutputCacheInputsToBuildTargets(
    tree,
    BUN_INSTALL_SETTINGS_INPUTS
  );

  await formatFiles(tree);
}
