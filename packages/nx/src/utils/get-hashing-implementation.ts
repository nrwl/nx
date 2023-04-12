import { NativeFileHasher } from '../hasher/native-file-hasher';
import { workspaceRoot } from './workspace-root';

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export enum HasherImplementation {
  Native = 'Native',
  Git = 'Git',
  Node = 'Node',
}

export function getHashingImplementation() {
  try {
    if (
      (!process.env.NX_NON_NATIVE_HASHER ||
        process.env.NX_NON_NATIVE_HASHER != 'true') &&
      NativeFileHasher.available()
    ) {
      return HasherImplementation.Native;
    }

    execSync('git rev-parse --is-inside-work-tree', {
      stdio: 'ignore',
      windowsHide: true,
    });

    // we don't use git based hasher when the repo uses git submodules
    if (!existsSync(join(workspaceRoot, '.git', 'modules'))) {
      return HasherImplementation.Git;
    } else {
      return HasherImplementation.Node;
    }
  } catch {
    return HasherImplementation.Node;
  }
}
