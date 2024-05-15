import { tmpdir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
import { workspaceRoot } from '../utils/workspace-root';

export const nativeFileCacheLocation = join(
  tmpdir(),
  'nx-native-file-cache',
  createHash('sha256').update(workspaceRoot).digest('hex')
);
