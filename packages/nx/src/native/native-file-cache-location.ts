import { tmpdir, userInfo } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
import { workspaceRoot } from '../utils/workspace-root';

export function getNativeFileCacheLocation() {
  if (process.env.NX_NATIVE_FILE_CACHE_DIRECTORY) {
    return process.env.NX_NATIVE_FILE_CACHE_DIRECTORY;
  } else {
    const hash = createHash('sha256').update(workspaceRoot);

    try {
      hash.update(userInfo().username);
    } catch (e) {
      // if there's no user, we only use the workspace root for the hash and move on
    }

    return join(
      tmpdir(),
      `nx-native-file-cache-${hash.digest('hex').substring(0, 7)}`
    );
  }
}
