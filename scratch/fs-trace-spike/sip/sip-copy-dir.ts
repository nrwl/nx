import { release } from 'node:os';
import { dirname, join } from 'node:path';
import {
  ensureOwnedPrivateDir,
  ensureSafeSharedRoot,
} from '../../../packages/nx/src/utils/owned-private-dir';
import { NX_USER_TMP_DIR } from '../../../packages/nx/src/utils/nx-tmp-dir';

export const SIP_COPY_ROOT = join(NX_USER_TMP_DIR, 'sip-copies');

/**
 * Owner-only directory for ad-hoc re-signed copies of binaries dyld strips
 * `DYLD_INSERT_LIBRARIES` for, or `null` when it cannot be established, in which
 * case tracing stops at those binaries. Traced processes execute what is in
 * here, so it is held to the native file cache's bar. One directory per kernel
 * release, so an OS update starts clean.
 */
export function ensureSipCopyDir(root: string = SIP_COPY_ROOT): string | null {
  if (process.platform !== 'darwin') {
    return null;
  }
  const userRoot = dirname(root);
  if (ensureSafeSharedRoot(dirname(userRoot)).status !== 'ok') {
    return null;
  }
  const releaseDir = join(root, release());
  for (const dir of [userRoot, root, releaseDir]) {
    if (ensureOwnedPrivateDir(dir).status !== 'ok') {
      return null;
    }
  }
  return releaseDir;
}
