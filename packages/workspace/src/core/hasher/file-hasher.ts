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

  /**
   * For the project graph daemon server use-case we can potentially skip expensive work
   * by leveraging knowledge of the uncommitted and untracked files, so the init() method
   * returns a Map containing this data.
   */
  init(): Map<string, string> {
    performance.mark('init hashing:start');
    this.clear();

    const getFileHashesResult = getFileHashes(appRootPath);
    this.applyFileHashes(getFileHashesResult.allFiles);
    this.usesGitForHashing = Object.keys(this.fileHashes).length > 0;
    this.isInitialized = true;

    performance.mark('init hashing:end');
    performance.measure(
      'init hashing',
      'init hashing:start',
      'init hashing:end'
    );

    return getFileHashesResult.untrackedUncommittedFiles;
  }

  /**
   * This method is used in cases where we do not want to fully tear down the
   * known state of file hashes, and instead only want to hash an updated Map
   * of files which are provided to the method.
   *
   * For example, the daemon server performs file-watching and knows at a granular
   * level what needs to be rehashed in order to accurately update the overall state.
   */
  incrementalUpdate(updatedHashes: Map<string, string>): void {
    performance.mark('incremental hashing:start');

    updatedHashes.forEach((hash, filename) => {
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

  /**
   * In the case of the daemon server, because it performs file-watching, it
   * knows when one or more files have been deleted from the workspace and can
   * therefore precisely update the source of truth for file hashes and workspace
   * files.
   */
  removeFiles(deletedFiles: string[]): void {
    for (const deletedFile of deletedFiles) {
      delete this.fileHashes[deletedFile];
      this.workspaceFiles.delete(deletedFile);
    }
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

  private applyFileHashes(allFiles: Map<string, string>): void {
    const sliceIndex = appRootPath.length + 1;
    allFiles.forEach((hash, filename) => {
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
