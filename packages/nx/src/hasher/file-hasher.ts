import { performance } from 'perf_hooks';
import { workspaceRoot } from '../utils/workspace-root';
import { FileData } from '../config/project-graph';

export class FileHasher {
  private fileHashes: Map<string, string>;
  private isInitialized = false;

  async init(): Promise<void> {
    performance.mark('init hashing:start');
    // Import as needed. There is also an issue running unit tests in Nx repo if this is a top-level import.
    const { hashFiles } = require('../native');
    this.clear();
    const filesObject = hashFiles(workspaceRoot);
    this.fileHashes = new Map(Object.entries(filesObject));

    performance.mark('init hashing:end');
    performance.measure(
      'init hashing',
      'init hashing:start',
      'init hashing:end'
    );
  }

  hashFile(path: string): string {
    // Import as needed. There is also an issue running unit tests in Nx repo if this is a top-level import.
    const { hashFile } = require('../native');
    return hashFile(path).hash;
  }

  hashFilesMatchingGlobs(path: string, globs: string[]): string {
    // Import as needed. There is also an issue running unit tests in Nx repo if this is a top-level import.
    const { hashFilesMatchingGlobs } = require('../native');
    return hashFilesMatchingGlobs(path, globs);
  }

  clear(): void {
    this.fileHashes = new Map<string, string>();
    this.isInitialized = false;
  }

  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.init();
    }
  }

  async hashFiles(files: string[]): Promise<Map<string, string>> {
    const r = new Map<string, string>();
    for (let f of files) {
      r.set(f, this.hashFile(f));
    }
    return r;
  }

  allFileData(): FileData[] {
    const res = [];
    this.fileHashes.forEach((hash, file) => {
      res.push({
        file,
        hash,
      });
    });
    res.sort((x, y) => x.file.localeCompare(y.file));
    return res;
  }

  incrementalUpdate(
    updatedFiles: Map<string, string>,
    deletedFiles: string[] = []
  ): void {
    performance.mark('incremental hashing:start');

    updatedFiles.forEach((hash, filename) => {
      this.fileHashes.set(filename, hash);
    });

    for (const deletedFile of deletedFiles) {
      this.fileHashes.delete(deletedFile);
    }

    performance.mark('incremental hashing:end');
    performance.measure(
      'incremental hashing',
      'incremental hashing:start',
      'incremental hashing:end'
    );
  }
}

export const fileHasher = new FileHasher();

export function hashArray(content: string[]): string {
  // Import as needed. There is also an issue running unit tests in Nx repo if this is a top-level import.
  const { hashArray } = require('../native');
  return hashArray(content);
}
