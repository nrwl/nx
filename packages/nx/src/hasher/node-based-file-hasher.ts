import { workspaceRoot } from '../utils/app-root';
import { performance } from 'perf_hooks';
import { FileData } from '../config/project-graph';
import { join, relative } from 'path';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { FileHasherBase } from './file-hasher-base';
import { stripIndents } from '../utils/strip-indents';
import ignore from 'ignore';
import { normalizePath } from '../utils/path';

export class NodeBasedFileHasher extends FileHasherBase {
  ignoredGlobs = getIgnoredGlobs();

  async init() {
    performance.mark('init hashing:start');
    this.clear();

    this.allFilesInDir(workspaceRoot, true);

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
    const relDirName = relative(workspaceRoot, absoluteDirName);
    if (relDirName && this.ignoredGlobs.ignores(relDirName)) {
      return;
    }
    try {
      readdirSync(absoluteDirName).forEach((c) => {
        const absoluteChild = join(absoluteDirName, c);
        const relChild = relative(workspaceRoot, absoluteChild);
        if (this.ignoredGlobs.ignores(relChild)) {
          return;
        }
        try {
          const s = statSync(absoluteChild);
          if (!s.isDirectory()) {
            this.fileHashes.set(
              normalizePath(relChild),
              this.hashFile(relChild)
            );
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
  ig.add(readFileIfExisting(`${workspaceRoot}/.gitignore`));
  ig.add(readFileIfExisting(`${workspaceRoot}/.nxignore`));
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
