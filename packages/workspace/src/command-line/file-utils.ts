import * as path from 'path';
import * as fs from 'fs';
import { appRootPath } from '../utils/app-root';
import { extname } from 'path';
import { mtime } from './shared';
import { jsonDiff } from '../utils/json-diff';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
const ignore = require('ignore');

export interface FileData {
  file: string;
  mtime: number;
  ext: string;
}

export interface FileChange extends FileData {
  getChanges: () => any[];
}

export function calculateFileChanges(
  files: string[],
  base: void | string,
  head: void | string,
  readFileAtRevision: (
    f: string,
    r: void | string
  ) => string = defaultReadFileAtRevision
): FileChange[] {
  return files.map(f => {
    const ext = extname(f);
    const _mtime = mtime(`${appRootPath}/${f}`);
    // Memoize results so we don't recalculate on successive invocation.
    let value: any[] = null;

    return {
      file: f,
      ext,
      mtime: _mtime,
      getChanges: () => {
        if (!value) {
          switch (ext) {
            case '.json':
              if (base) {
                const atBase = readFileAtRevision(f, base);
                const atHead = readFileAtRevision(f, head);
                value = jsonDiff(atBase, atHead);
              } else {
                value = [];
              }
              break;
            default:
              throw new Error(`Cannot call getChanges() on ${f}`);
          }
        }
        return value;
      }
    };
  });
}

const TEN_MEGABYTES = 1024 * 10000;

function defaultReadFileAtRevision(
  file: string,
  revision: void | string
): string {
  try {
    return !revision
      ? readFileSync(file).toString()
      : execSync(`git show ${revision}:${file}`, {
          maxBuffer: TEN_MEGABYTES
        })
          .toString()
          .trim();
  } catch {
    return '';
  }
}

export function allFilesInDir(
  dirName: string,
  recurse: boolean = true
): FileData[] {
  const ignoredGlobs = getIgnoredGlobs();
  const relDirName = path.relative(appRootPath, dirName);
  if (relDirName && ignoredGlobs.ignores(relDirName)) {
    return [];
  }

  let res = [];
  try {
    fs.readdirSync(dirName).forEach(c => {
      const child = path.join(dirName, c);
      if (ignoredGlobs.ignores(path.relative(appRootPath, child))) {
        return;
      }
      try {
        const s = fs.statSync(child);
        if (!s.isDirectory()) {
          // add starting with "apps/myapp/..." or "libs/mylib/..."
          res.push({
            file: path
              .relative(appRootPath, child)
              .split(path.sep)
              .join('/'),
            ext: path.extname(child),
            mtime: s.mtimeMs
          });
        } else if (s.isDirectory() && recurse) {
          res = [...res, ...allFilesInDir(child)];
        }
      } catch (e) {}
    });
  } catch (e) {}
  return res;
}

function getIgnoredGlobs() {
  const ig = ignore();
  ig.add(readFileIfExisting(`${appRootPath}/.gitignore`));
  ig.add(readFileIfExisting(`${appRootPath}/.nxignore`));
  return ig;
}

function readFileIfExisting(path: string) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'UTF-8').toString() : '';
}
