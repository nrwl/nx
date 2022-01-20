import { GitBasedFileHasher } from './git-based-file-hasher';
import { joinPathFragments } from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { NodeBasedFileHasher } from './node-based-file-hasher';
import { FileHasherBase } from './file-hasher-base';
import { statSync } from 'fs';

function createFileHasher(): FileHasherBase {
  try {
    statSync(joinPathFragments(appRootPath, '.git')).isDirectory();
    return new GitBasedFileHasher();
  } catch {
    return new NodeBasedFileHasher();
  }
}

export const defaultFileHasher = createFileHasher();
