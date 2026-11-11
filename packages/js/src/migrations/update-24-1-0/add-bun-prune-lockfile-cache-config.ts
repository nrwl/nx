import { formatFiles, type Tree } from '@nx/devkit';
import { addPruneLockfileCacheConfig } from '../../utils/prune-lockfile-cache-config';

export default async function update(tree: Tree) {
  addPruneLockfileCacheConfig(tree, {
    lockFile: 'bun.lock',
    // The `bun patch` files and the vendored local-path dependencies the
    // executor emits next to the pruned lockfile; without them in `outputs`, a
    // cache replay restores only the manifest and the lockfile.
    artifacts: ['patches', 'local_path_modules'],
    // The root manifest declares the trusted install scripts and the patches
    // the output carries. The trust list reaches no package's hash, so nothing
    // else in the hash moves when a package is untrusted.
    rootInputs: ['{workspaceRoot}/package.json'],
  });

  await formatFiles(tree);
}
