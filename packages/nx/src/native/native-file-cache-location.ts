import { userInfo } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
import { NX_TMP_DIR } from '../utils/nx-tmp-dir';
import { workspaceRoot } from '../utils/workspace-root';
import { nxVersion } from '../utils/versions';

export function getNativeFileCacheLocation() {
  if (process.env.NX_NATIVE_FILE_CACHE_DIRECTORY) {
    return process.env.NX_NATIVE_FILE_CACHE_DIRECTORY;
  } else {
    const hash = createHash('sha256').update(workspaceRoot).update(nxVersion);

    try {
      hash.update(userInfo().username);
    } catch (e) {
      // if there's no user, we only use the workspace root for the hash and move on
    }

    // The cache lives under the fixed NX_TMP_DIR root rather than os.tmpdir():
    // tmpdir() honors $TMPDIR, which the daemon's environment does not include
    // (see daemon-environment.ts), and sandboxes (e.g. AI agent sandboxes)
    // allowlist the fixed /tmp/.nx root via `nx configure-ai-agents` — a
    // tmpdir()-based location would be unwritable there and the native binding
    // would fail to load.
    return join(
      NX_TMP_DIR,
      `native-file-cache-${hash.digest('hex').substring(0, 7)}`
    );
  }
}
