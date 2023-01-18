import { GitBasedFileHasher } from './git-based-file-hasher';
import { workspaceRoot } from '../utils/workspace-root';
import { NodeBasedFileHasher } from './node-based-file-hasher';
import { FileHasherBase } from './file-hasher-base';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

function createFileHasher(): FileHasherBase {
  // special case for unit tests
  if (workspaceRoot === '/root') {
    return new NodeBasedFileHasher();
  }
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    // we don't use git based hasher when the repo uses git submodules
    if (!existsSync(join(workspaceRoot, '.git', 'modules'))) {
      return new GitBasedFileHasher();
    } else {
      return new NodeBasedFileHasher();
    }
  } catch {
    return new NodeBasedFileHasher();
  }
}

export const defaultFileHasher = createFileHasher();
