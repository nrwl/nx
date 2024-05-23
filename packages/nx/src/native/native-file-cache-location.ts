import { tmpdir, userInfo } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
import { workspaceRoot } from '../utils/workspace-root';

export function getNativeFileCacheLocation() {
  if (process.env.NX_NATIVE_FILE_CACHE_DIRECTORY) {
    return process.env.NX_NATIVE_FILE_CACHE_DIRECTORY;
  } else {
    const shortHash = createHash('sha256')
      .update(userInfo().username)
      .update(workspaceRoot)
      .digest('hex')
      .substring(0, 7);
    return join(tmpdir(), `nx-native-file-cache-${shortHash}`);
  }
}
