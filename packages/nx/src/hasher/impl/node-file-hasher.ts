import { workspaceRoot } from '../../utils/workspace-root';
import { performance } from 'perf_hooks';
import { FileData } from '../../config/project-graph';
import { join, relative } from 'path';
import { readdirSync, readFileSync, statSync } from 'fs';
import { FileHasher, FileHasherBase } from './file-hasher-base';
import { stripIndents } from '../../utils/strip-indents';
import ignore from 'ignore';
import { normalizePath } from '../../utils/path';
import { getIgnoreObject } from '../../utils/ignore';
import { joinPathFragments } from '../../utils/path';
import { createHash } from 'crypto';

export class NodeFileHasher extends FileHasherBase implements FileHasher {
  ignoredGlobs: ReturnType<typeof ignore> = getIgnoredGlobs();

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

  hashFile(path: string): string {
    if (!this.fileHashes) {
      throw new Error('FileHasher is invoked before being initialized');
    }
    const relativePath = normalizePath(
      path.startsWith(workspaceRoot)
        ? path.slice(workspaceRoot.length + 1)
        : path
    );
    try {
      // this has to be absolute to avoid issues with cwd
      return this.hashContent(
        readFileSync(joinPathFragments(workspaceRoot, relativePath))
      );
    } catch {
      return '';
    }
  }

  private hashContent(content: Buffer) {
    const hasher = createHash('sha256');
    hasher.update(content);
    return hasher.digest('hex');
  }
}
export function nodeHashArray(input: string[]): string {
  const hasher = createHash('sha256');
  for (const part of input) {
    // intentional single equals to check for null and undefined
    if (part != undefined) {
      hasher.update(part);
    }
  }
  return hasher.digest('hex');
}

function getIgnoredGlobs() {
  const ig = getIgnoreObject();
  ig.add(stripIndents`
      node_modules
      tmp
      dist
      build
    `);
  return ig;
}
