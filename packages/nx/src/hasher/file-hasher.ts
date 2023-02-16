import { performance } from 'perf_hooks';
import { hashFile, hashFiles } from '../native';
import { workspaceRoot } from '../utils/workspace-root';
import { FileData } from '../config/project-graph';
import { joinPathFragments, normalizePath } from '../utils/path';

class NativeFileHasher {
  private fileHashes: Map<string, string>;
  private isInitialized = false;

  clear(): void {
    this.fileHashes = new Map<string, string>();
    this.isInitialized = false;
  }

  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.init();
    }
  }

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

  hashFile(path: string): string {
    if (!this.fileHashes) {
      throw new Error('FileHasher is invoked before being initialized');
    }

    const relativePath = normalizePath(
      path.startsWith(workspaceRoot)
        ? path.slice(workspaceRoot.length + 1)
        : path
    );

    // Import as needed. There is also an issue running unit tests in Nx repo if this is a top-level import.
    const { hashFile } = require('../native');
    return hashFile(joinPathFragments(workspaceRoot, relativePath)).hash;
  }
}

export const defaultFileHasher = new NativeFileHasher();
