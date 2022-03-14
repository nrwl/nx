import { appRootPath } from 'nx/src/utils/app-root';
import { performance } from 'perf_hooks';
import { FileData } from 'nx/src/shared/project-graph';
import { join, relative } from 'path';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { FileHasherBase } from './file-hasher-base';
import { stripIndents } from '@nrwl/devkit';
import ignore from 'ignore';

export class NodeBasedFileHasher extends FileHasherBase {
  ignoredGlobs = getIgnoredGlobs();

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
        const absoluteChild = join(absoluteDirName, c);
        const relChild = relative(appRootPath, absoluteChild);
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

function getIgnoredGlobs() {
  const ig = ignore();
  ig.add(readFileIfExisting(`${appRootPath}/.gitignore`));
  ig.add(readFileIfExisting(`${appRootPath}/.nxignore`));
  ig.add(stripIndents`
      node_modules
      tmp
      dist
      build    
    `);
  return ig;
}

function readFileIfExisting(path: string) {
  return existsSync(path) ? readFileSync(path, 'utf-8') : '';
}
