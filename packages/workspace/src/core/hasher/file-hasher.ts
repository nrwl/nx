import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { performance } from 'perf_hooks';
import {
  getFileHashes,
  getUntrackedAndUncommittedFileHashes,
} from './git-hasher';
import { defaultHashing, HashingImpl } from './hashing-impl';

export class FileHasher {
  fileHashes: { [path: string]: string } = {};
  workspaceFiles = new Set<string>();
  usesGitForHashing = false;
  private isInitialized = false;

  constructor(private readonly hashing: HashingImpl) {}

  clear(): void {
    this.fileHashes = {};
    this.workspaceFiles = new Set<string>();
    this.usesGitForHashing = false;
  }

  init(): void {
    performance.mark('init hashing:start');
    this.clear();
    this.getHashesFromGit();
    this.usesGitForHashing = Object.keys(this.fileHashes).length > 0;
    this.isInitialized = true;
    performance.mark('init hashing:end');
    performance.measure(
      'init hashing',
      'init hashing:start',
      'init hashing:end'
    );
  }

  /**
   * This method is used in cases where we do not want to fully tear down the
   * known state of file hashes, and instead only want to hash the currently
   * uncommitted (both staged and unstaged) non-deleted files.
   *
   * For example, the daemon server can cache the last known commit SHA in
   * memory and avoid calling init() by using this method instead when that
   * SHA is unchanged.
   */
  incrementalUpdate() {
    performance.mark('incremental hashing:start');

    const untrackedAndUncommittedFileHashes =
      getUntrackedAndUncommittedFileHashes(appRootPath);

    untrackedAndUncommittedFileHashes.forEach((hash, filename) => {
      this.fileHashes[filename] = hash;
      /**
       * we have to store it separately because fileHashes can be modified
       * later on and can contain files that do not exist in the workspace
       */
      this.workspaceFiles.add(filename);
    });

    performance.mark('incremental hashing:end');
    performance.measure(
      'incremental hashing',
      'incremental hashing:start',
      'incremental hashing:end'
    );
  }

  hashFile(path: string): string {
    this.ensureInitialized();

    const relativePath = path.startsWith(appRootPath)
      ? path.substr(appRootPath.length + 1)
      : path;
    if (!this.fileHashes[relativePath]) {
      this.fileHashes[relativePath] = this.processPath(path);
    }
    return this.fileHashes[relativePath];
  }

  ensureInitialized(): void {
    if (!this.isInitialized) {
      this.init();
    }
  }

  private getHashesFromGit(): void {
    const sliceIndex = appRootPath.length + 1;
    getFileHashes(appRootPath).forEach((hash, filename) => {
      this.fileHashes[filename.substr(sliceIndex)] = hash;
      /**
       * we have to store it separately because fileHashes can be modified
       * later on and can contain files that do not exist in the workspace
       */
      this.workspaceFiles.add(filename.substr(sliceIndex));
    });
  }

  private processPath(path: string): string {
    try {
      return this.hashing.hashFile(path);
    } catch {
      return '';
    }
  }
}

export const defaultFileHasher = new FileHasher(defaultHashing);
