import { performance } from 'perf_hooks';
import { FileData } from '../../config/project-graph';

export interface FileHasher {
  init(): Promise<void>;

  hashFile(path: string): string;

  clear(): void;

  ensureInitialized();

  hashFiles(files: string[]): Promise<Map<string, string>>;

  allFileData(): FileData[];

  incrementalUpdate(
    updatedFiles: Map<string, string>,
    deletedFiles: string[]
  ): void;
}

export abstract class FileHasherBase {
  protected fileHashes: Map<string, string>;
  protected isInitialized = false;

  abstract init(): Promise<void>;

  abstract hashFile(path: string): string;

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
