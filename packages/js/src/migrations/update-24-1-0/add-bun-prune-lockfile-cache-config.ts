import { formatFiles, type Tree } from '@nx/devkit';
import { addPruneLockfileCacheConfig } from '../../utils/prune-lockfile-cache-config';

// The `bun patch` files and the vendored local-path dependencies the executor
// emits next to the pruned lockfile; without them in `outputs`, a cache replay
// restores only the manifest and the lockfile.
const ARTIFACTS = ['patches', 'local_path_modules'];
// The root manifest declares the trusted install scripts and the patches the
// output carries. The trust list reaches no package's hash, so nothing else in
// the hash moves when a package is untrusted.
const ROOT_INPUTS = ['{workspaceRoot}/package.json'];

export default async function update(tree: Tree) {
  addPruneLockfileCacheConfig(tree, {
    lockFile: 'bun.lock',
    artifacts: ARTIFACTS,
    rootInputs: ROOT_INPUTS,
  });
  // A target generated on the binary bun.lockb declares that file, and the
  // executor writes the text bun.lock once the workspace switches to it.
  addPruneLockfileCacheConfig(tree, {
    lockFile: 'bun.lockb',
    artifacts: ['bun.lock', ...ARTIFACTS],
    rootInputs: ROOT_INPUTS,
  });

  await formatFiles(tree);
}
