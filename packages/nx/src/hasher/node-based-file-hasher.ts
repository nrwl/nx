import { workspaceRoot } from '../utils/workspace-root';
import { performance } from 'perf_hooks';
import { FileData } from '../config/project-graph';
import { join, relative } from 'path';
import { readdirSync, statSync } from 'fs';
import { FileHasherBase } from './file-hasher-base';
import ignore, { Ignore } from 'ignore';
import { normalizePath } from '../utils/path';
import { getIgnoredGlobsAndIgnore } from '../utils/ignore-patterns';

export class NodeBasedFileHasher extends FileHasherBase {
  fileIsIgnored: (p) => boolean;

  async init() {
    performance.mark('init hashing:start');
    this.clear();
    this.fileIsIgnored = await getAllIgnoredGlobs();
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
    if (relDirName && this.fileIsIgnored(relDirName)) {
      return;
    }
    try {
      readdirSync(absoluteDirName).forEach((c) => {
        const absoluteChild = join(absoluteDirName, c);
        const relChild = relative(workspaceRoot, absoluteChild);
        if (this.fileIsIgnored(relChild)) {
          return;
        }
        try {
          const s = statSync(absoluteChild);
          if (s.isFile()) {
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

async function getAllIgnoredGlobs() {
  return (
    await getIgnoredGlobsAndIgnore({
      knownIgnoredPaths: ['tmp', 'dist', 'build'],
    })
  ).fileIsIgnored;
}
