import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { performance } from 'perf_hooks';
import { defaultHashing } from './hashing-impl';
import { FileData } from '@nrwl/tao/src/shared/project-graph';
import { joinPathFragments } from '@nrwl/devkit';

export abstract class FileHasherBase {
  protected fileHashes: Map<string, string>;
  protected isInitialized = false;

  clear(): void {
    this.fileHashes = new Map<string, string>();
    this.isInitialized = false;
  }

  abstract init(): Promise<void>;

  abstract hashFiles(files: string[]): Promise<Map<string, string>>;

  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.init();
    }
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
    const relativePath = path.startsWith(appRootPath)
      ? path.substr(appRootPath.length + 1)
      : path;
    if (this.fileHashes.has(relativePath)) {
      return this.fileHashes.get(relativePath);
    } else {
      try {
        // this has to be absolute to avoid issues with cwd
        return defaultHashing.hashFile(
          joinPathFragments(appRootPath, relativePath)
        );
      } catch {
        return '';
      }
    }
  }
}
