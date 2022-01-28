import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { performance } from 'perf_hooks';
import { FileData } from '@nrwl/tao/src/shared/project-graph';
import { relative } from 'path';
import { readdirSync, statSync } from 'fs';
import { FileHasherBase } from './file-hasher-base';
import { getIgnoredGlobs } from '../file-utils';
import { joinPathFragments } from '@nrwl/devkit';

export class NodeBasedFileHasher extends FileHasherBase {
  ignoredGlobs = getIgnoredGlobs().add([
    'node_modules',
    'tmp',
    'dist',
    'build',
  ]);

  async init() {
    performance.mark('init hashing:start');
    this.clear();

    this.allFilesInDir(appRootPath, true);

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

  private allFilesInDir(
    absoluteDirName: string,
    recurse: boolean = true
  ): FileData[] {
    const relDirName = relative(appRootPath, absoluteDirName);
    if (relDirName && this.ignoredGlobs.ignores(relDirName)) {
      return;
    }
    try {
      readdirSync(absoluteDirName).forEach((c) => {
        const absoluteChild = joinPathFragments(absoluteDirName, c);
        const relChild = relative(appRootPath, absoluteChild).replace(
          /\\/g,
          '/'
        );
        if (this.ignoredGlobs.ignores(relChild)) {
          return;
        }
        try {
          const s = statSync(absoluteChild);
          if (!s.isDirectory()) {
            this.fileHashes.set(relChild, this.hashFile(relChild));
          } else if (s.isDirectory() && recurse) {
            this.allFilesInDir(absoluteChild, true);
          }
        } catch {}
      });
    } catch {}
  }
}
