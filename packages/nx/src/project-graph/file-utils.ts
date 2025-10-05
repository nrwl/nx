import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { extname, join, relative, sep } from 'path';
import type { FileData } from '../config/project-graph';
import type { NxArgs } from '../utils/command-line-utils';
import { readJsonFile } from '../utils/fileutils';
import { getIgnoreObject } from '../utils/ignore';
import { jsonDiff } from '../utils/json-diff';
import { workspaceRoot } from '../utils/workspace-root';

export interface Change {
  type: string;
}

export interface FileChange<T extends Change = Change> {
  file: string;
  getChanges: () => T[];
}

export class WholeFileChange implements Change {
  type = 'WholeFileChange';
}

export class DeletedFileChange implements Change {
  type = 'WholeFileDeleted';
}

export function isWholeFileChange(change: Change): change is WholeFileChange {
  return change.type === 'WholeFileChange';
}

export function isDeletedFileChange(
  change: Change
): change is DeletedFileChange {
  return change.type === 'WholeFileDeleted';
}

export function calculateFileChanges(
  files: string[],
  nxArgs?: NxArgs,
  readFileAtRevision: {
    (f: string, r: string | void): string;
  } = defaultReadFileAtRevision,
  ignore = getIgnoreObject() as ReturnType<typeof ignore>
): FileChange[] {
  files = files.filter((f) => !ignore.ignores(f));

  return files.map((f) => {
    const ext = extname(f);

    return {
      file: f,
      getChanges: (): Change[] => {
        if (!existsSync(join(workspaceRoot, f))) {
          return [new DeletedFileChange()];
        }

        if (!nxArgs) {
          return [new WholeFileChange()];
        }

        if (nxArgs.files && nxArgs.files.includes(f)) {
          return [new WholeFileChange()];
        }
        switch (ext) {
          case '.json':
            try {
              const atBase = readFileAtRevision(f, nxArgs.base);
              const atHead = readFileAtRevision(f, nxArgs.head);
              return jsonDiff(JSON.parse(atBase), JSON.parse(atHead));
            } catch (e) {
              return [new WholeFileChange()];
            }
          case '.yml':
          case '.yaml':
            const { load } = require('@zkochan/js-yaml');
            try {
              const atBase = readFileAtRevision(f, nxArgs.base);
              const atHead = readFileAtRevision(f, nxArgs.head);
              return jsonDiff(load(atBase), load(atHead));
            } catch (e) {
              return [new WholeFileChange()];
            }
          default:
            return [new WholeFileChange()];
        }
      },
    };
  });
}

export const TEN_MEGABYTES = 1024 * 10000;

function defaultReadFileAtRevision(
  file: string,
  revision: void | string
): string {
  try {
    const fileFullPath = `${workspaceRoot}${sep}${file}`;
    const gitRepositoryPath = execSync('git rev-parse --show-toplevel')
      .toString()
      .trim();
    const filePathInGitRepository = relative(gitRepositoryPath, fileFullPath)
      .split(sep)
      .join('/');
    return !revision
      ? readFileSync(file, 'utf-8')
      : execSync(`git show ${revision}:${filePathInGitRepository}`, {
          maxBuffer: TEN_MEGABYTES,
          stdio: ['pipe', 'pipe', 'ignore'],
          windowsHide: false,
        })
          .toString()
          .trim();
  } catch {
    return '';
  }
}

export function defaultFileRead(filePath: string): string | null {
  return readFileSync(join(workspaceRoot, filePath), 'utf-8');
}

export function readPackageJson(root: string = workspaceRoot): any {
  try {
    return readJsonFile(`${root}/package.json`);
  } catch {
    return {}; // if package.json doesn't exist
  }
}

// Original Exports
export { FileData };
