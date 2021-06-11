import { getFileHashes } from './git-hasher';
import { readFileSync } from 'fs';
import { defaultHashing, HashingImpl } from './hashing-impl';
import { appRootPath } from '../../utilities/app-root';
import { performance } from 'perf_hooks';

export class FileHasher {
  fileHashes: { [path: string]: string } = {};
  workspaceFiles: string[] = [];
  usesGitForHashing = false;

  constructor(private readonly hashing: HashingImpl) {
    this.init();
  }

  clear(): void {
    this.fileHashes = {};
    this.workspaceFiles = [];
    this.usesGitForHashing = false;
  }

  init(): void {
    performance.mark('init hashing:start');
    this.clear();
    this.getHashesFromGit();
    this.usesGitForHashing = Object.keys(this.fileHashes).length > 0;
    performance.mark('init hashing:end');
    performance.measure(
      'init hashing',
      'init hashing:start',
      'init hashing:end'
    );
  }

  hashFile(path: string, transformer?: (content: string) => string): string {
    const relativePath = path.startsWith(appRootPath)
      ? path.substr(appRootPath.length + 1)
      : path;
    if (!this.fileHashes[relativePath]) {
      this.fileHashes[relativePath] = this.processPath(path, transformer);
    }
    return this.fileHashes[relativePath];
  }

  private getHashesFromGit(): void {
    const sliceIndex = appRootPath.length + 1;
    getFileHashes(appRootPath).forEach((hash, filename) => {
      this.fileHashes[filename.substr(sliceIndex)] = hash;
      /**
       * we have to store it separately because fileHashes can be modified
       * later on and can contain files that do not exist in the workspace
       */
      this.workspaceFiles.push(filename.substr(sliceIndex));
    });
  }

  private processPath(
    path: string,
    transformer?: (content: string) => string
  ): string {
    try {
      if (transformer) {
        const transformedFile = transformer(readFileSync(path, 'utf-8'));
        return this.hashing.hashArray([transformedFile]);
      } else {
        return this.hashing.hashFile(path);
      }
    } catch {
      return '';
    }
  }
}

export const defaultFileHasher = new FileHasher(defaultHashing);
