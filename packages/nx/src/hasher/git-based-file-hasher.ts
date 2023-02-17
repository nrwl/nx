import { workspaceRoot } from '../utils/workspace-root';
import { performance } from 'perf_hooks';
import { getFileHashes, getGitHashForFiles } from './git-hasher';
import { existsSync, readFileSync } from 'fs';
import { FileHasherBase } from './file-hasher-base';
import ignore from 'ignore';

export class GitBasedFileHasher extends FileHasherBase {
  /**
   * For the project graph daemon server use-case we can potentially skip expensive work
   * by leveraging knowledge of the uncommitted and untracked files, so the init() method
   * returns a Map containing this data.
   */
  async init() {
    performance.mark('init hashing:start');
    this.clear();

    const gitResult = await getFileHashes(workspaceRoot);
    const ignore = getIgnoredGlobs();
    gitResult.allFiles.forEach((hash, filename) => {
      if (!ignore.ignores(filename)) {
        this.fileHashes.set(filename, hash);
      }
    });
    this.isInitialized = true;
    performance.mark('init hashing:end');
    performance.measure(
      'init hashing',
      'init hashing:start',
      'init hashing:end'
    );
  }

  async hashFiles(files: string[]) {
    return (await getGitHashForFiles(files, workspaceRoot)).hashes;
  }
}

function getIgnoredGlobs() {
  if (existsSync(`${workspaceRoot}/.nxignore`)) {
    const ig = ignore();
    ig.add(readFileSync(`${workspaceRoot}/.nxignore`, 'utf-8'));
    return ig;
  } else {
    return { ignores: (file: string) => false };
  }
}
