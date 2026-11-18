import { formatFiles, type Tree } from '@nx/devkit';
import { PNPM_MAJOR_RUNTIME_INPUT } from '../../utils/pnpm-install-settings-inputs';
import { addPruneLockfileCacheConfig } from '../../utils/prune-lockfile-cache-config';

export default async function update(tree: Tree) {
  addPruneLockfileCacheConfig(tree, {
    lockFile: 'pnpm-lock.yaml',
    // Artifacts the executor emits next to the pruned lockfile; without them
    // in `outputs`, a cache replay restores only the manifest and the lockfile.
    artifacts: ['pnpm-workspace.yaml', 'patches', 'local_path_modules'],
    // The workspace root files those artifacts are built from. Neither the
    // pnpm build approvals nor `supportedArchitectures` are recorded in the
    // lockfile, so nothing else in the hash moves when they change. The pnpm
    // major decides which emitted file carries them, and the ambient binary
    // supplies it when the manifest's `packageManager` field is absent, so the
    // major probe is added alongside.
    rootInputs: [
      '{workspaceRoot}/pnpm-workspace.yaml',
      '{workspaceRoot}/package.json',
      PNPM_MAJOR_RUNTIME_INPUT,
    ],
  });

  await formatFiles(tree);
}
