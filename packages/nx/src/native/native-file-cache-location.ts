import { tmpdir, userInfo } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
import { workspaceRoot } from '../utils/workspace-root';

export const nativeFileCacheLocation = join(
  getNativeFileCacheBaseFolder(),
  createHash('sha256')
    .update(workspaceRoot)
    .update(userInfo().username)
    .digest('hex')
);

function getNativeFileCacheBaseFolder() {
  if (process.env.NX_NATIVE_FILE_CACHE_DIRECTORY) {
    return process.env.NX_NATIVE_FILE_CACHE_DIRECTORY;
  } else {
    const shortUserHash = createHash('sha256')
      .update(userInfo().username)
      .digest('hex')
      .substring(0, 7);
    return join(tmpdir(), `nx-native-file-cache-${shortUserHash}`);
  }
}
