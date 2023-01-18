import { FileHasherBase } from './file-hasher-base';
import { performance } from 'perf_hooks';
import { hashFile, hashFiles } from '@nrwl/native-extensions';
import { workspaceRoot } from '../utils/app-root';

export class NativeFileHasher extends FileHasherBase {
  async init(): Promise<void> {
    performance.mark('init hashing:start');
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
    return hashFile(path).hash;
  }
}
