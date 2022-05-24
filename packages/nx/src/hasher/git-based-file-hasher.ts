import { performance } from 'perf_hooks';
import { createNxignore } from '../utils/ignore';
import { workspaceRoot } from '../utils/workspace-root';
import { FileHasherBase } from './file-hasher-base';
import { getFileHashes, getGitHashForFiles } from './git-hasher';

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
    const ignore = createNxignore();
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
