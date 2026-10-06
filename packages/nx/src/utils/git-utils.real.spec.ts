import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  cloneFromUpstream,
  getPathCommitExposure,
  getWorkingTreeStatus,
  tryCommitChanges,
} from './git-utils';

function runGit(args: string[], cwd: string) {
  execFileSync('git', args, { cwd, stdio: 'ignore', windowsHide: true });
}

describe('GitRepository', () => {
  // The payload exercises POSIX shell expansion. Windows requires a cmd-specific payload.
  (process.platform === 'win32' ? it.skip : it)(
    'does not execute a hostile remote branch name during import preparation',
    async () => {
      const tempDirectory = mkdtempSync(join(tmpdir(), 'nx-import-git-utils-'));
      const marker = join(tempDirectory, 'nx-import-pwn');
      const maliciousRef = `$(touch\${IFS}${marker})`;
      const sourceRepository = join(tempDirectory, 'source');
      const clonedRepository = join(tempDirectory, 'cloned');

      try {
        mkdirSync(sourceRepository);
        runGit(['init'], sourceRepository);
        runGit(['config', 'user.email', 'test@example.com'], sourceRepository);
        runGit(['config', 'user.name', 'Test User'], sourceRepository);
        writeFileSync(join(sourceRepository, 'source.txt'), 'source');
        runGit(['add', 'source.txt'], sourceRepository);
        runGit(['commit', '-m', 'initial commit'], sourceRepository);
        runGit(['checkout', '-b', maliciousRef], sourceRepository);

        const git = await cloneFromUpstream(
          sourceRepository,
          clonedRepository,
          { originName: '__tmp_nx_import__' }
        );
        const ref = (await git.listBranches()).find(
          (branch) => branch === maliciousRef
        );
        expect(ref).toBe(maliciousRef);

        await git.addFetchRemote('__tmp_nx_import__', ref!);
        await git.fetch('__tmp_nx_import__', ref!);
        await git.checkout(`__nx_tmp_import__/${ref!}`, {
          new: true,
          base: `__tmp_nx_import__/${ref!}`,
        });
        await git.mergeUnrelatedHistories(
          `__tmp_nx_import__/${ref!}`,
          `feat(repo): merge ${ref!}`
        );

        expect(
          readFileSync(join(clonedRepository, 'source.txt'), 'utf-8')
        ).toBe('source');
        expect(existsSync(marker)).toBe(false);
      } finally {
        rmSync(tempDirectory, { recursive: true, force: true });
      }
    }
  );
});

describe('getPathCommitExposure', () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'nx-exposure-'));
    runGit(['init'], repo);
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it('reports ignored for a directory-only rule even when the directory does not exist yet', () => {
    // A trailing-slash entry matches only directories; git cannot tell an
    // absent path is one unless the query says so. This is the case a bare
    // check-ignore query misclassifies.
    writeFileSync(join(repo, '.gitignore'), '.nx/migrate-runs/\n');

    expect(getPathCommitExposure('.nx/migrate-runs', repo)).toBe('ignored');
  });

  it('reports ignored for a bare rule when the directory does not exist yet', () => {
    writeFileSync(join(repo, '.gitignore'), '.nx/migrate-runs\n');

    expect(getPathCommitExposure('.nx/migrate-runs', repo)).toBe('ignored');
  });

  it('reports ignored when the directory holds only untracked files', () => {
    writeFileSync(join(repo, '.gitignore'), '.nx/migrate-runs\n');
    mkdirSync(join(repo, '.nx/migrate-runs/run-1'), { recursive: true });
    writeFileSync(join(repo, '.nx/migrate-runs/run-1/run.json'), '{}');

    expect(getPathCommitExposure('.nx/migrate-runs', repo)).toBe('ignored');
  });

  it('reports tracked when files under the directory are in the index, despite a matching ignore rule', () => {
    writeFileSync(join(repo, '.gitignore'), '.nx/migrate-runs\n');
    mkdirSync(join(repo, '.nx/migrate-runs/run-1'), { recursive: true });
    writeFileSync(join(repo, '.nx/migrate-runs/run-1/run.json'), '{}');
    runGit(['add', '-f', '.nx/migrate-runs/run-1/run.json'], repo);

    expect(getPathCommitExposure('.nx/migrate-runs', repo)).toBe('tracked');
  });

  it('reports unignored when no rule covers the directory', () => {
    expect(getPathCommitExposure('.nx/migrate-runs', repo)).toBe('unignored');
  });

  it('reports unknown outside a git repository', () => {
    const plain = mkdtempSync(join(tmpdir(), 'nx-exposure-plain-'));
    try {
      expect(getPathCommitExposure('.nx/migrate-runs', plain)).toBe('unknown');
    } finally {
      rmSync(plain, { recursive: true, force: true });
    }
  });
});

describe('getWorkingTreeStatus with excluded paths', () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'nx-tree-status-'));
    runGit(['init'], repo);
    runGit(['config', 'user.email', 'test@example.com'], repo);
    runGit(['config', 'user.name', 'Test User'], repo);
    runGit(['commit', '--allow-empty', '-m', 'initial commit'], repo);
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it('reads clean when the only dirt is untracked and unignored under an excluded path', () => {
    mkdirSync(join(repo, '.nx/migrate-runs/run-1'), { recursive: true });
    writeFileSync(join(repo, '.nx/migrate-runs/run-1/run.json'), '{}');

    expect(getWorkingTreeStatus(repo)).toBe('dirty');
    expect(getWorkingTreeStatus(repo, ['.nx/migrate-runs'])).toBe('clean');
  });

  it('agrees with what tryCommitChanges would stage under the same exclusion', () => {
    // The commit excludes the scratch dir the same way, so a probe that reads
    // clean here is exactly the case where the commit would otherwise fail
    // with nothing staged.
    mkdirSync(join(repo, '.nx/migrate-runs/run-1'), { recursive: true });
    writeFileSync(join(repo, '.nx/migrate-runs/run-1/run.json'), '{}');
    expect(() =>
      tryCommitChanges('scratch only', repo, ['.nx/migrate-runs'])
    ).toThrow(/nothing added to commit/);

    writeFileSync(join(repo, 'source.txt'), 'changed');
    expect(getWorkingTreeStatus(repo, ['.nx/migrate-runs'])).toBe('dirty');
    expect(tryCommitChanges('real change', repo, ['.nx/migrate-runs'])).toMatch(
      /^[0-9a-f]{40}$/
    );
  });

  it('still sees dirt outside the current directory, as git add -A does', () => {
    const nested = join(repo, 'packages/app');
    mkdirSync(join(nested, '.nx/migrate-runs/run-1'), { recursive: true });
    writeFileSync(join(nested, '.nx/migrate-runs/run-1/run.json'), '{}');
    writeFileSync(join(repo, 'outside.txt'), 'x');

    expect(getWorkingTreeStatus(nested, ['.nx/migrate-runs'])).toBe('dirty');

    rmSync(join(repo, 'outside.txt'));
    expect(getWorkingTreeStatus(nested, ['.nx/migrate-runs'])).toBe('clean');
  });
});
