jest.mock('../../../utils/git-utils', () => ({
  hasUncommittedChanges: jest.fn(),
  tryCommitChanges: jest.fn(),
}));
jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn() },
}));

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  hasUncommittedChanges,
  tryCommitChanges,
} from '../../../utils/git-utils';
import { logger } from '../../../utils/logger';
import {
  applyAgenticHandoffGitignoreFallback,
  isHandoffGitignoreMigration,
} from './handoff-gitignore';

const mockHas = hasUncommittedChanges as jest.Mock;
const mockTry = tryCommitChanges as jest.Mock;
const mockInfo = logger.info as jest.Mock;

const HANDOFF_GITIGNORE_MIGRATION = {
  package: 'nx',
  name: '23-0-0-add-migrate-runs-to-git-ignore',
  version: '23.0.0-beta.18',
};

const COMMIT_PREFIX = 'chore: [nx migration] ';

// picocolors wraps logger output in ANSI escapes when the runtime detects a
// TTY. Strip them in assertions so the message reads as intended rather than
// a tangle of escape codes.
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;
const stripAnsi = (s: string): string => s.replace(ANSI_RE, '');

describe('isHandoffGitignoreMigration', () => {
  it('matches the nx v23 add-migrate-runs-to-git-ignore migration by composite identity', () => {
    expect(isHandoffGitignoreMigration(HANDOFF_GITIGNORE_MIGRATION)).toBe(true);
  });

  it('does not match the same migration name in a different package (composite identity)', () => {
    expect(
      isHandoffGitignoreMigration({
        package: '@evil/pkg',
        name: '23-0-0-add-migrate-runs-to-git-ignore',
      })
    ).toBe(false);
  });
});

describe('applyAgenticHandoffGitignoreFallback', () => {
  let workspace: string;
  const gitignorePath = () => join(workspace, '.gitignore');

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'nx-handoff-gitignore-'));
    mockHas.mockReset();
    mockTry.mockReset();
    mockInfo.mockReset();
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('defers to the hoist path when the v23 gitignore migration is in the queue (primary check wins over the version fallback)', async () => {
    writeFileSync(gitignorePath(), 'node_modules\n');
    await applyAgenticHandoffGitignoreFallback({
      migrations: [
        HANDOFF_GITIGNORE_MIGRATION,
        { package: '@nx/react', name: 'some-other' },
      ],
      // Pre-v23 nx — without the primary "migration in queue" check, the
      // version fallback below would fire and apply the entry inline. The
      // assertion locks in that the migration-in-queue signal wins.
      installedNxVersion: '22.5.0',
      effectiveCreateCommits: true,
      commitPrefix: COMMIT_PREFIX,
      root: workspace,
    });
    expect(readFileSync(gitignorePath(), 'utf-8')).toBe('node_modules\n');
    expect(mockTry).not.toHaveBeenCalled();
    expect(mockInfo).not.toHaveBeenCalled();
  });

  it('does nothing when the migration is not in the queue and installed nx is at v23+ (respect conscious removal)', async () => {
    writeFileSync(gitignorePath(), 'node_modules\n');
    await applyAgenticHandoffGitignoreFallback({
      migrations: [{ package: '@nx/react', name: 'some-23-mig' }],
      installedNxVersion: '23.2.0',
      effectiveCreateCommits: true,
      commitPrefix: COMMIT_PREFIX,
      root: workspace,
    });
    expect(readFileSync(gitignorePath(), 'utf-8')).toBe('node_modules\n');
    expect(mockTry).not.toHaveBeenCalled();
    expect(mockInfo).not.toHaveBeenCalled();
  });

  it('treats a v23 prerelease (e.g. 23.0.0-beta.1) installed as "past v23" — the major check is intentional', async () => {
    writeFileSync(gitignorePath(), 'node_modules\n');
    await applyAgenticHandoffGitignoreFallback({
      migrations: [{ package: '@nx/react', name: 'some-mig' }],
      installedNxVersion: '23.0.0-beta.1',
      effectiveCreateCommits: true,
      commitPrefix: COMMIT_PREFIX,
      root: workspace,
    });
    expect(readFileSync(gitignorePath(), 'utf-8')).toBe('node_modules\n');
    expect(mockTry).not.toHaveBeenCalled();
  });

  it('applies the gitignore entry inline and creates a preflight commit when installed nx < v23 and commits are enabled', async () => {
    writeFileSync(gitignorePath(), 'node_modules\n');
    mockHas.mockReturnValue(true);
    mockTry.mockReturnValue('abc123');

    await applyAgenticHandoffGitignoreFallback({
      migrations: [{ package: '@nx/react', name: 'some-22-mig' }],
      installedNxVersion: '22.5.0',
      effectiveCreateCommits: true,
      commitPrefix: COMMIT_PREFIX,
      root: workspace,
    });

    // `addEntryToGitIgnore` joins existing content with the new entry via
    // '\n'. When the existing file ends in '\n' (as user-authored
    // .gitignore files typically do), the join produces a blank line
    // between the prior content and the new entry. That's the utility's
    // existing behavior; we just assert the entry lands.
    expect(readFileSync(gitignorePath(), 'utf-8')).toBe(
      'node_modules\n\n.nx/migrate-runs'
    );
    expect(mockTry).toHaveBeenCalledWith(
      `${COMMIT_PREFIX}add .nx/migrate-runs to .gitignore`,
      workspace
    );
    const messages = mockInfo.mock.calls.map((c) => stripAnsi(c[0]));
    expect(messages).toEqual([
      `- Added .nx/migrate-runs to .gitignore so this --agentic run's handoff scratch is ignored.`,
      `  Commit: abc123`,
    ]);
  });

  it('applies the gitignore entry inline but skips the commit when commits are disabled', async () => {
    writeFileSync(gitignorePath(), 'node_modules\n');

    await applyAgenticHandoffGitignoreFallback({
      migrations: [{ package: '@nx/react', name: 'some-22-mig' }],
      installedNxVersion: '22.5.0',
      effectiveCreateCommits: false,
      commitPrefix: COMMIT_PREFIX,
      root: workspace,
    });

    expect(readFileSync(gitignorePath(), 'utf-8')).toBe(
      'node_modules\n\n.nx/migrate-runs'
    );
    expect(mockTry).not.toHaveBeenCalled();
    expect(mockHas).not.toHaveBeenCalled();
    const messages = mockInfo.mock.calls.map((c) => stripAnsi(c[0]));
    expect(messages).toEqual([
      `- Added .nx/migrate-runs to .gitignore so this --agentic run's handoff scratch is ignored.`,
    ]);
  });

  it('is a no-op when the entry is already covered by an existing pattern', async () => {
    writeFileSync(gitignorePath(), 'node_modules\n.nx\n');
    await applyAgenticHandoffGitignoreFallback({
      migrations: [{ package: '@nx/react', name: 'some-22-mig' }],
      installedNxVersion: '22.5.0',
      effectiveCreateCommits: true,
      commitPrefix: COMMIT_PREFIX,
      root: workspace,
    });
    expect(readFileSync(gitignorePath(), 'utf-8')).toBe('node_modules\n.nx\n');
    expect(mockTry).not.toHaveBeenCalled();
  });

  it('skips the commit step but keeps the .gitignore mutation when `hasUncommittedChanges` returns false (race / filter)', async () => {
    writeFileSync(gitignorePath(), 'node_modules\n');
    mockHas.mockReturnValue(false);

    await applyAgenticHandoffGitignoreFallback({
      migrations: [{ package: '@nx/react', name: 'some-22-mig' }],
      installedNxVersion: '22.5.0',
      effectiveCreateCommits: true,
      commitPrefix: COMMIT_PREFIX,
      root: workspace,
    });

    expect(readFileSync(gitignorePath(), 'utf-8')).toBe(
      'node_modules\n\n.nx/migrate-runs'
    );
    expect(mockTry).not.toHaveBeenCalled();
  });

  it('logs a yellow warning but leaves the .gitignore mutation in place when the commit attempt throws', async () => {
    writeFileSync(gitignorePath(), 'node_modules\n');
    mockHas.mockReturnValue(true);
    mockTry.mockImplementation(() => {
      throw new Error('error: gpg failed to sign the data');
    });

    await applyAgenticHandoffGitignoreFallback({
      migrations: [{ package: '@nx/react', name: 'some-22-mig' }],
      installedNxVersion: '22.5.0',
      effectiveCreateCommits: true,
      commitPrefix: COMMIT_PREFIX,
      root: workspace,
    });

    expect(readFileSync(gitignorePath(), 'utf-8')).toBe(
      'node_modules\n\n.nx/migrate-runs'
    );
    const warningMessage = stripAnsi(mockInfo.mock.calls.at(-1)![0]);
    expect(warningMessage).toContain(
      'Could not create the agentic preflight commit'
    );
    expect(warningMessage).toContain('error: gpg failed to sign the data');
    expect(warningMessage).toContain('remains in the working tree');
  });

  it('is silent on a successful commit when `tryCommitChanges` returns null (HEAD-resolve race)', async () => {
    writeFileSync(gitignorePath(), 'node_modules\n');
    mockHas.mockReturnValue(true);
    mockTry.mockReturnValue(null);

    await applyAgenticHandoffGitignoreFallback({
      migrations: [{ package: '@nx/react', name: 'some-22-mig' }],
      installedNxVersion: '22.5.0',
      effectiveCreateCommits: true,
      commitPrefix: COMMIT_PREFIX,
      root: workspace,
    });

    expect(mockTry).toHaveBeenCalledTimes(1);
    const messages = mockInfo.mock.calls.map((c) => stripAnsi(c[0]));
    // The 'Added ...' line is emitted; the 'Commit: <sha>' line is NOT —
    // we have nothing meaningful to print when the sha could not be
    // resolved, and the diff cleared from the working tree.
    expect(messages).toEqual([
      `- Added .nx/migrate-runs to .gitignore so this --agentic run's handoff scratch is ignored.`,
    ]);
  });
});
