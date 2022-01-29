import { GitBasedFileHasher } from './git-based-file-hasher';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { NodeBasedFileHasher } from './node-based-file-hasher';
import { FileHasherBase } from './file-hasher-base';
import { execSync, spawnSync } from 'child_process';

function createFileHasher(): FileHasherBase {
  // special case for unit tests
  if (appRootPath === '/root') {
    return new NodeBasedFileHasher();
  }
  try {
    // Check if we can spawn git
    spawnSync('git', ['--version'], { stdio: 'ignore' });
    return new GitBasedFileHasher();
  } catch {
    try {
      execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
      return new GitBasedFileHasher();
    } catch {
      return new NodeBasedFileHasher();
    }
  }
}

export const defaultFileHasher = createFileHasher();
