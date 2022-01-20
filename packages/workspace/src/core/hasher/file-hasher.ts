import { GitBasedFileHasher } from './git-based-file-hasher';
import { joinPathFragments } from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { NodeBasedFileHasher } from './node-based-file-hasher';
import { FileHasherBase } from './file-hasher-base';
import { statSync } from 'fs';
import { execSync } from 'child_process';

function createFileHasher(): FileHasherBase {
  // special case for unit tests
  if (appRootPath === '/root') {
    return new NodeBasedFileHasher();
  }
  try {
    // checking the folder first, cause it is faster
    statSync(joinPathFragments(appRootPath, '.git')).isDirectory();
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
