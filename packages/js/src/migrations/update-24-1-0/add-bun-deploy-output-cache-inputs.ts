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
  // A workspace on the binary bun.lockb gets the inputs too: its output
  // carries the trust list once it switches to bun.lock.
  if (!tree.exists('bun.lock') && !tree.exists('bun.lockb')) {
    return;
  }
  await addDeployOutputCacheInputsToBuildTargets(
    tree,
    BUN_INSTALL_SETTINGS_INPUTS
  );

  await formatFiles(tree);
}
