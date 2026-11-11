import { formatFiles, type Tree } from '@nx/devkit';
import { addDeployOutputCacheInputsToBuildTargets } from '../../utils/deploy-output-cache-inputs';
import { PNPM_INSTALL_SETTINGS_INPUTS } from '../../utils/pnpm-install-settings-inputs';

/**
 * Adds the workspace-root pnpm install settings sources to the `inputs` of
 * build targets that emit the pruned pnpm deploy output. The build approvals
 * and `supportedArchitectures` those outputs carry reach no lockfile, so
 * without these a revoked approval leaves the task hash unchanged and a cached
 * run replays an output that still grants it.
 */
export default async function update(tree: Tree) {
  // The deploy output's install settings are pnpm-specific; other package
  // managers' outputs hash everything they are built from already.
  if (!tree.exists('pnpm-lock.yaml')) {
    return;
  }
  await addDeployOutputCacheInputsToBuildTargets(
    tree,
    PNPM_INSTALL_SETTINGS_INPUTS
  );

  await formatFiles(tree);
}
