import {
  parseVcsRemoteUrl,
  getVcsRemoteInfo,
  getGitCurrentBranch,
  getPathCommitExposure,
  getUncommittedChangesSnapshot,
  getWorkingTreeStatus,
  isAncestorCommit,
  tryCommitChanges,
} from './git-utils';
import { execSync } from 'child_process';
import * as fs from 'fs';

jest.mock('child_process');
jest.mock('fs', () => {
  const actual: typeof import('fs') = jest.requireActual('fs');
  return {
    ...actual,
    readFileSync: jest.fn(actual.readFileSync),
  };
});

describe('git utils tests', () => {
  describe('parseVcsRemoteUrl', () => {
    it('should parse GitHub SSH URLs', () => {
      expect(parseVcsRemoteUrl('git@github.com:nrwl/nx.git')).toEqual({
        domain: 'github.com',
        slug: 'nrwl/nx',
      });
    });

    it('should parse GitHub SSH URLs with period (ssh)', () => {
      expect(parseVcsRemoteUrl('git@github.com:nrwl.abc/nx.abc.git')).toEqual({
        domain: 'github.com',
        slug: 'nrwl.abc/nx.abc',
      });
    });

    it('should parse GitHub HTTPS URLs', () => {
      expect(parseVcsRemoteUrl('https://github.com/nrwl/nx.git')).toEqual({
        domain: 'github.com',
        slug: 'nrwl/nx',
      });
    });

    it('should parse GitHub SSH URLs with period (https)', () => {
      expect(
        parseVcsRemoteUrl('https://github.com/nrwl.abc/nx.abc.git')
      ).toEqual({
        domain: 'github.com',
        slug: 'nrwl.abc/nx.abc',
      });
    });

    it('should parse GitHub Enterprise SSH URLs', () => {
      expect(
        parseVcsRemoteUrl('git@github.enterprise.com:org/repo.git')
      ).toEqual({
        domain: 'github.enterprise.com',
        slug: 'org/repo',
      });
    });

    it('custom domains ssh', () => {
      expect(parseVcsRemoteUrl('git@enterprise.com:org/repo.git')).toEqual({
        domain: 'enterprise.com',
        slug: 'org/repo',
      });
    });

    it('should parse GitHub Enterprise HTTPS URLs', () => {
      expect(
        parseVcsRemoteUrl('https://github.enterprise.com/org/repo.git')
      ).toEqual({
        domain: 'github.enterprise.com',
        slug: 'org/repo',
      });
    });

    it('custom domains', () => {
      expect(parseVcsRemoteUrl('https://enterprise.com/org/repo.git')).toEqual({
        domain: 'enterprise.com',
        slug: 'org/repo',
      });
    });

    it('should parse GitLab SSH URLs', () => {
      expect(
        parseVcsRemoteUrl('git@gitlab.com:group.abc/project.abc.git')
      ).toEqual({
        domain: 'gitlab.com',
        slug: 'group.abc/project.abc',
      });
    });

    it('should parse GitLab HTTPS URLs', () => {
      expect(parseVcsRemoteUrl('https://gitlab.com/group/project.git')).toEqual(
        {
          domain: 'gitlab.com',
          slug: 'group/project',
        }
      );
    });

    it('should parse Bitbucket SSH URLs', () => {
      expect(parseVcsRemoteUrl('git@bitbucket.org:team/repo.git')).toEqual({
        domain: 'bitbucket.org',
        slug: 'team/repo',
      });
    });

    it('should parse Bitbucket HTTPS URLs', () => {
      expect(parseVcsRemoteUrl('https://bitbucket.org/team/repo.git')).toEqual({
        domain: 'bitbucket.org',
        slug: 'team/repo',
      });
    });

    it('should parse HTTPS URLs with authentication', () => {
      expect(
        parseVcsRemoteUrl('https://user@gitlab.com/group.abc/project.abc.git')
      ).toEqual({
        domain: 'gitlab.com',
        slug: 'group.abc/project.abc',
      });
    });

    it('should parse SSH URLs with alternative format', () => {
      expect(
        parseVcsRemoteUrl('ssh://git@gitlab.com/group.abc/project.abc.git')
      ).toEqual({
        domain: 'gitlab.com',
        slug: 'group.abc/project.abc',
      });
    });

    it('should parse SSH URLs with port', () => {
      expect(
        parseVcsRemoteUrl('ssh://git@gitlab.com:2222/group.abc/project.abc.git')
      ).toEqual({
        domain: 'gitlab.com',
        slug: 'group.abc/project.abc',
      });
    });

    it('should handle URLs without .git extension', () => {
      expect(parseVcsRemoteUrl('git@github.com:nrwl.abc/nx.abc')).toEqual({
        domain: 'github.com',
        slug: 'nrwl.abc/nx.abc',
      });
    });

    it('should return null for invalid URLs', () => {
      expect(parseVcsRemoteUrl('not-a-valid-url')).toBeNull();
      expect(parseVcsRemoteUrl('')).toBeNull();
      expect(parseVcsRemoteUrl('https://example.com')).toBeNull();
    });
  });

  describe('getVcsRemoteInfo', () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    it('should return VCS info for GitHub remote', () => {
      (execSync as jest.Mock).mockReturnValue(`
        origin	git@github.com:nrwl/nx.git (fetch)
        origin	git@github.com:nrwl/nx.git (push)
      `);

      expect(getVcsRemoteInfo()).toEqual({
        domain: 'github.com',
        slug: 'nrwl/nx',
      });
    });

    it('should return VCS info for GitLab remote', () => {
      (execSync as jest.Mock).mockReturnValue(`
        origin	git@gitlab.com:group/project.git (fetch)
        origin	git@gitlab.com:group/project.git (push)
      `);

      expect(getVcsRemoteInfo()).toEqual({
        domain: 'gitlab.com',
        slug: 'group/project',
      });
    });

    it('should prioritize origin over other remotes', () => {
      (execSync as jest.Mock).mockReturnValue(`
        upstream	git@gitlab.com:other/project.git (fetch)
        upstream	git@gitlab.com:other/project.git (push)
        origin	git@github.com:nrwl/nx.git (fetch)
        origin	git@github.com:nrwl/nx.git (push)
      `);

      expect(getVcsRemoteInfo()).toEqual({
        domain: 'github.com',
        slug: 'nrwl/nx',
      });
    });

    it('should return null when no remotes exist', () => {
      (execSync as jest.Mock).mockReturnValue('');

      expect(getVcsRemoteInfo()).toBeNull();
    });

    it('should return null when execSync throws', () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('git not found');
      });

      expect(getVcsRemoteInfo()).toBeNull();
    });
  });

  describe('getGitCurrentBranch', () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    it('should return the current branch name', () => {
      (execSync as jest.Mock).mockReturnValue('main\n');

      expect(getGitCurrentBranch()).toBe('main');
    });

    it('should return null for a detached HEAD', () => {
      (execSync as jest.Mock).mockReturnValue('HEAD\n');

      expect(getGitCurrentBranch()).toBeNull();
    });

    it('should return null for empty output', () => {
      (execSync as jest.Mock).mockReturnValue('\n');

      expect(getGitCurrentBranch()).toBeNull();
    });

    it('should return null when execSync throws', () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('not a git repository');
      });

      expect(getGitCurrentBranch()).toBeNull();
    });
  });

  describe('getWorkingTreeStatus', () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    it('should return dirty when git status reports changes', () => {
      (execSync as jest.Mock).mockReturnValue(' M file.ts\n');

      expect(getWorkingTreeStatus('/repo')).toBe('dirty');
    });

    it('should return clean when git status reports nothing', () => {
      (execSync as jest.Mock).mockReturnValue('\n');

      expect(getWorkingTreeStatus('/repo')).toBe('clean');
    });

    it('should return unknown, not clean, when the probe throws', () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('spawn git EAGAIN');
      });

      expect(getWorkingTreeStatus('/repo')).toBe('unknown');
    });
  });

  describe('getPathCommitExposure', () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    function failWithStatus(status: number): Error & { status: number } {
      return Object.assign(new Error(`exit ${status}`), { status });
    }

    it('should return tracked when files under the path are in the index, without consulting check-ignore', () => {
      (execSync as jest.Mock).mockReturnValueOnce(
        '.nx/migrate-runs/run-1/run.json\n'
      );

      expect(getPathCommitExposure('.nx/migrate-runs', '/repo')).toBe(
        'tracked'
      );
      expect(execSync).toHaveBeenCalledTimes(1);
      expect(execSync).toHaveBeenCalledWith(
        'git ls-files -- .nx/migrate-runs',
        expect.anything()
      );
    });

    it('should return ignored when nothing is tracked and check-ignore matches', () => {
      (execSync as jest.Mock).mockReturnValueOnce('\n').mockReturnValueOnce('');

      expect(getPathCommitExposure('.nx/migrate-runs', '/repo')).toBe(
        'ignored'
      );
      // The check-ignore query must carry a trailing slash: a directory-only
      // ignore rule (trailing-slash .gitignore entry) does not match a bare
      // query when the directory does not exist on disk yet.
      expect(execSync).toHaveBeenLastCalledWith(
        'git check-ignore -q .nx/migrate-runs/',
        expect.anything()
      );
    });

    it('should not double the trailing slash when the caller already passes one', () => {
      (execSync as jest.Mock).mockReturnValueOnce('\n').mockReturnValueOnce('');

      expect(getPathCommitExposure('.nx/migrate-runs/', '/repo')).toBe(
        'ignored'
      );
      expect(execSync).toHaveBeenLastCalledWith(
        'git check-ignore -q .nx/migrate-runs/',
        expect.anything()
      );
    });

    it('should return unignored when nothing is tracked and check-ignore reports no coverage', () => {
      (execSync as jest.Mock)
        .mockReturnValueOnce('\n')
        .mockImplementationOnce(() => {
          throw failWithStatus(1);
        });

      expect(getPathCommitExposure('.nx/migrate-runs', '/repo')).toBe(
        'unignored'
      );
    });

    it('should return unknown when the ls-files probe fails', () => {
      (execSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('spawn git EAGAIN');
      });

      expect(getPathCommitExposure('.nx/migrate-runs', '/repo')).toBe(
        'unknown'
      );
      expect(execSync).toHaveBeenCalledTimes(1);
    });

    it('should return unknown when check-ignore fails for any reason other than "not ignored"', () => {
      (execSync as jest.Mock)
        .mockReturnValueOnce('\n')
        .mockImplementationOnce(() => {
          throw failWithStatus(128);
        });

      expect(getPathCommitExposure('.nx/migrate-runs', '/repo')).toBe(
        'unknown'
      );
    });
  });

  describe('getUncommittedChangesSnapshot', () => {
    const mockReadFileSync = fs.readFileSync as jest.Mock;

    afterEach(() => {
      jest.resetAllMocks();
    });

    function mockGit(map: {
      diff?: string;
      status?: string;
      untracked?: string[];
      diffThrows?: boolean;
      statusThrows?: boolean;
      untrackedThrows?: boolean;
    }): void {
      (execSync as jest.Mock).mockImplementation((cmd: string) => {
        if (cmd.startsWith('git diff HEAD')) {
          if (map.diffThrows) throw new Error('git diff failed');
          return map.diff ?? '';
        }
        if (cmd.startsWith('git status')) {
          if (map.statusThrows) throw new Error('git status failed');
          return map.status ?? '';
        }
        if (cmd.startsWith('git ls-files')) {
          if (map.untrackedThrows) throw new Error('git ls-files failed');
          // `-z` mode emits NUL-terminated entries with no trailing newline.
          return (map.untracked ?? []).map((p) => `${p}\0`).join('');
        }
        return '';
      });
    }

    it('returns equal snapshots for an unchanged working tree across consecutive calls', () => {
      mockGit({ diff: '', status: '', untracked: [] });
      const a = getUncommittedChangesSnapshot('/repo');
      const b = getUncommittedChangesSnapshot('/repo');
      expect(a).toBe(b);
      expect(a).not.toBe('');
    });

    it('distinguishes different content at the same modified tracked path (the codex collision case)', () => {
      // Porcelain status is identical (`M package.json`) but the diff text
      // differs because the contents differ. A status-only snapshot would
      // collapse; the content-sensitive snapshot must not.
      mockGit({
        diff: 'diff --git a/package.json b/package.json\n+angular\n',
        status: ' M package.json\n',
        untracked: [],
      });
      const v1 = getUncommittedChangesSnapshot('/repo');
      mockGit({
        diff: 'diff --git a/package.json b/package.json\n+zone.js\n',
        status: ' M package.json\n',
        untracked: [],
      });
      const v2 = getUncommittedChangesSnapshot('/repo');
      expect(v1).not.toBe(v2);
    });

    it('detects a newly added untracked file', () => {
      mockGit({ diff: '', status: '', untracked: [] });
      const before = getUncommittedChangesSnapshot('/repo');
      mockGit({
        diff: '',
        status: '?? new.ts\n',
        untracked: ['new.ts'],
      });
      mockReadFileSync.mockReturnValue(Buffer.from('content'));
      const after = getUncommittedChangesSnapshot('/repo');
      expect(before).not.toBe(after);
    });

    it('detects an untracked file whose contents change without any path change', () => {
      mockGit({
        diff: '',
        status: '?? config.json\n',
        untracked: ['config.json'],
      });
      mockReadFileSync.mockReturnValueOnce(Buffer.from('content_v1'));
      const v1 = getUncommittedChangesSnapshot('/repo');
      mockReadFileSync.mockReturnValueOnce(Buffer.from('content_v2'));
      const v2 = getUncommittedChangesSnapshot('/repo');
      expect(v1).not.toBe(v2);
    });

    it('returns equal snapshots after a write-then-revert (net-zero) sequence', () => {
      mockGit({
        diff: 'diff --git a/f b/f\n+x\n',
        status: ' M f\n',
        untracked: [],
      });
      const a = getUncommittedChangesSnapshot('/repo');
      const b = getUncommittedChangesSnapshot('/repo');
      expect(a).toBe(b);
    });

    it('preserves surviving probe signal when one git invocation fails', () => {
      // A partial failure (status throws, diff still has real content) must
      // not silently collapse the snapshot down to the same value a fully-
      // clean working tree would produce — otherwise the catch-block
      // classification would lose the throw-after-write signal.
      mockGit({
        diff: 'diff --git a/f b/f\n+x\n',
        statusThrows: true,
        untracked: [],
      });
      const partial = getUncommittedChangesSnapshot('/repo');
      mockGit({ diff: '', status: '', untracked: [] });
      const clean = getUncommittedChangesSnapshot('/repo');
      expect(partial).not.toBe(clean);
    });
  });

  describe('tryCommitChanges', () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    it('preserves the original git error as `cause` so callers can inspect signal/status/code', () => {
      // Without `{ cause: err }` on the rethrow, callers lose .status /
      // .signal from the original ChildProcessError — only the formatted
      // message survives.
      const originalErr = Object.assign(
        new Error('Command failed: git commit ...'),
        {
          status: 128,
          signal: null,
          stderr: Buffer.from('error: gpg failed to sign the data\n'),
          stdout: Buffer.from(''),
        }
      );
      (execSync as jest.Mock).mockImplementation((cmd: string) => {
        if (cmd.startsWith('git commit')) throw originalErr;
        // Production code passes `encoding: 'utf8'` to `execSync`, so
        // mirror that with a string return rather than a Buffer.
        return '';
      });

      let caught: unknown;
      try {
        tryCommitChanges('msg', '/workspace');
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(Error);
      const wrapper = caught as Error & { cause?: unknown };
      expect(wrapper.message).toContain('gpg failed to sign');
      expect(wrapper.cause).toBe(originalErr);
      expect((wrapper.cause as { status?: number })?.status).toBe(128);
    });
  });

  describe('isAncestorCommit', () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    it('returns true when git confirms the ancestry', () => {
      (execSync as jest.Mock).mockReturnValue('');

      expect(isAncestorCommit('abc123', 'def456', '/repo')).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        'git merge-base --is-ancestor abc123 def456',
        expect.objectContaining({ cwd: '/repo' })
      );
    });

    it('accepts 64-char object ids from sha256 repositories', () => {
      (execSync as jest.Mock).mockReturnValue('');
      const sha256 = 'a'.repeat(64);

      expect(isAncestorCommit(sha256, sha256, '/repo')).toBe(true);
    });

    it('returns false when git rejects or fails', () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('exit 1');
      });

      expect(isAncestorCommit('abc123', 'def456', '/repo')).toBe(false);
    });

    it('returns false for a non-sha value without invoking git', () => {
      expect(isAncestorCommit('$(rm -rf /)', 'def456', '/repo')).toBe(false);
      expect(isAncestorCommit('abc123', 'HEAD~1', '/repo')).toBe(false);
      expect(execSync).not.toHaveBeenCalled();
    });
  });
});
