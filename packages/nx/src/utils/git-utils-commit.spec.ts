// Real-git coverage for tryCommitChanges' exclusions. Kept apart from
// git-utils.spec.ts, which mocks child_process: the regressions here are
// about git's actual behavior (`git add` refuses pathspecs naming ignored
// directories; a negative pathspec cannot unstage), which command-string
// assertions cannot see.

import { execSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { GIT_SHA, tryCommitChanges } from './git-utils';

const SCRATCH = '.nx/migrate-runs';

function git(cwd: string, command: string): string {
  return execSync(`git ${command}`, {
    encoding: 'utf8',
    stdio: 'pipe',
    cwd,
    windowsHide: true,
  });
}

function initRepo(cwd: string): void {
  git(cwd, 'init -q');
  git(cwd, 'config user.email test@test');
  git(cwd, 'config user.name test');
  git(cwd, 'config commit.gpgsign false');
}

function committedPaths(cwd: string): string[] {
  return git(cwd, 'ls-tree -r --name-only HEAD').trim().split('\n');
}

describe('tryCommitChanges exclusions (real git)', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-git-commit-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('commits a source change while the ignored scratch directory exists', () => {
    // The normal orchestrated flow: scratch is ignored and present. An
    // add-time exclusion pathspec makes `git add` exit 1 here ("The following
    // paths are ignored by one of your .gitignore files"), failing every
    // migration commit.
    initRepo(root);
    writeFileSync(join(root, '.gitignore'), `${SCRATCH}\n`);
    mkdirSync(join(root, SCRATCH), { recursive: true });
    writeFileSync(join(root, SCRATCH, 'run.json'), '{}');
    writeFileSync(join(root, 'a.txt'), 'a');

    const sha = tryCommitChanges('msg', root, [SCRATCH]);

    expect(sha).toMatch(GIT_SHA);
    expect(committedPaths(root)).toEqual(['.gitignore', 'a.txt']);
  });

  it('keeps scratch out of the commit after its ignore rule went missing', () => {
    initRepo(root);
    writeFileSync(join(root, 'a.txt'), 'a');
    git(root, 'add -A');
    git(root, 'commit -q --no-verify -m init');
    // No .gitignore: a checkout or a migration's own edit dropped the rule.
    mkdirSync(join(root, SCRATCH), { recursive: true });
    writeFileSync(join(root, SCRATCH, 'run.json'), '{}');
    writeFileSync(join(root, 'b.txt'), 'b');

    const sha = tryCommitChanges('msg', root, [SCRATCH]);

    expect(sha).toMatch(GIT_SHA);
    expect(committedPaths(root)).toEqual(['a.txt', 'b.txt']);
    // The scratch files themselves stay in the working tree.
    expect(git(root, 'status --porcelain').trim()).toBe(`?? .nx/`);
  });

  it('keeps a scratch file out of the commit when it was staged before the call', () => {
    // An add-time exclusion pathspec cannot cover this: it only limits what
    // the add stages, and the entry is already in the index.
    initRepo(root);
    writeFileSync(join(root, '.gitignore'), `${SCRATCH}\n`);
    mkdirSync(join(root, SCRATCH), { recursive: true });
    writeFileSync(join(root, SCRATCH, 'run.json'), '{}');
    git(root, `add -f ${SCRATCH}/run.json`);
    writeFileSync(join(root, 'a.txt'), 'a');

    const sha = tryCommitChanges('msg', root, [SCRATCH]);

    expect(sha).toMatch(GIT_SHA);
    expect(committedPaths(root)).toEqual(['.gitignore', 'a.txt']);
  });

  it('excludes the workspace-relative scratch when the workspace is nested in a larger repo', () => {
    // The exclusion is relative to the directory the commit runs in, which is
    // the Nx workspace root, not necessarily the git root.
    initRepo(root);
    const workspace = join(root, 'workspace');
    mkdirSync(join(workspace, SCRATCH), { recursive: true });
    writeFileSync(join(workspace, SCRATCH, 'run.json'), '{}');
    writeFileSync(join(workspace, 'a.txt'), 'a');

    const sha = tryCommitChanges('msg', workspace, [SCRATCH]);

    expect(sha).toMatch(GIT_SHA);
    expect(committedPaths(root)).toEqual(['workspace/a.txt']);
  });
});
