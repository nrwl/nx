import { execFileSync, execSync } from 'child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { extname, join, relative, sep } from 'path';
import type { FileData } from '../config/project-graph';
import type { NxArgs } from '../utils/command-line-utils';
import { readJsonFile } from '../utils/fileutils';
import { assertValidGitRevision } from '../utils/git-revision';
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

export class LockFileChange implements Change {
  type = 'LockFileChange';
  constructor(
    public baseContent: string,
    public headContent: string
  ) {}
}

export function isWholeFileChange(change: Change): change is WholeFileChange {
  return change.type === 'WholeFileChange';
}

export function isDeletedFileChange(
  change: Change
): change is DeletedFileChange {
  return change.type === 'WholeFileDeleted';
}

export function isLockFileChange(change: Change): change is LockFileChange {
  return change.type === 'LockFileChange';
}

const TEXT_LOCK_FILES = new Set([
  'yarn.lock',
  'package-lock.json',
  'pnpm-lock.yaml',
  'pnpm-lock.yml',
  'bun.lock',
]);
const BINARY_LOCK_FILES = new Set(['bun.lockb']);

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
    const basename = f.split('/').pop() ?? f;

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

        if (TEXT_LOCK_FILES.has(basename) || BINARY_LOCK_FILES.has(basename)) {
          try {
            const atBase = readLockFileAtRevision(
              f,
              basename,
              nxArgs.base,
              readFileAtRevision
            );
            const atHead = readLockFileAtRevision(
              f,
              basename,
              nxArgs.head,
              readFileAtRevision
            );
            return [new LockFileChange(atBase, atHead)];
          } catch {
            return [new WholeFileChange()];
          }
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

function readLockFileAtRevision(
  file: string,
  lockFileName: string,
  revision: void | string,
  readFileAtRevision: (f: string, r: string | void) => string
): string {
  if (
    lockFileName === 'bun.lockb' &&
    readFileAtRevision === defaultReadFileAtRevision
  ) {
    return defaultReadBunLockFileAtRevision(file, revision);
  }

  return readFileAtRevision(file, revision);
}

export const TEN_MEGABYTES = 1024 * 10000;

function defaultReadFileAtRevision(
  file: string,
  revision: void | string
): string {
  if (revision) {
    assertValidGitRevision(revision);
  }
  try {
    const filePathInGitRepository = getFilePathInGitRepository(file);
    return !revision
      ? readFileSync(file, 'utf-8')
      : execFileSync(
          'git',
          ['show', `${revision}:${filePathInGitRepository}`],
          {
            maxBuffer: TEN_MEGABYTES,
            stdio: ['pipe', 'pipe', 'ignore'],
            windowsHide: true,
          }
        )
          .toString()
          .trim();
  } catch {
    return '';
  }
}

function defaultReadBunLockFileAtRevision(
  file: string,
  revision: void | string
): string {
  if (!revision) {
    return execFileSync('bun', [join(workspaceRoot, file)], {
      encoding: 'utf-8',
      maxBuffer: TEN_MEGABYTES,
      windowsHide: true,
    }).trim();
  }

  assertValidGitRevision(revision);
  const filePathInGitRepository = getFilePathInGitRepository(file);
  const tempDirectory = mkdtempSync(join(tmpdir(), 'nx-bun-lock-'));
  const tempLockfilePath = join(tempDirectory, 'bun.lockb');

  try {
    const lockFileContents = execFileSync(
      'git',
      ['show', `${revision}:${filePathInGitRepository}`],
      {
        maxBuffer: TEN_MEGABYTES,
        stdio: ['pipe', 'pipe', 'ignore'],
        windowsHide: true,
      }
    );

    writeFileSync(tempLockfilePath, lockFileContents);

    return execFileSync('bun', [tempLockfilePath], {
      encoding: 'utf-8',
      maxBuffer: TEN_MEGABYTES,
      windowsHide: true,
    }).trim();
  } finally {
    rmSync(tempDirectory, { force: true, recursive: true });
  }
}

function getFilePathInGitRepository(file: string): string {
  const fileFullPath = `${workspaceRoot}${sep}${file}`;
  const gitRepositoryPath = execSync('git rev-parse --show-toplevel', {
    windowsHide: true,
  })
    .toString()
    .trim();

  return relative(gitRepositoryPath, fileFullPath).split(sep).join('/');
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
