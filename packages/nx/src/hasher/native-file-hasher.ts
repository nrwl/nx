import { FileHasherBase } from './file-hasher-base';
import { performance } from 'perf_hooks';
import { workspaceRoot } from '../utils/app-root';

export class NativeFileHasher extends FileHasherBase {
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

  hashFile(path: string): string {
    // Import as needed. There is also an issue running unit tests in Nx repo if this is a top-level import.
    const { hashFile } = require('../native');
    return hashFile(path).hash;
  }
}
