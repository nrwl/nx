jest.mock('../../utils/git-utils', () => ({
  hasUncommittedChanges: jest.fn(),
  tryCommitChanges: jest.fn(),
  getGitCurrentBranch: jest.fn(),
  getGitRemoteNames: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn() },
}));
jest.mock('../../utils/output', () => ({
  output: { warn: jest.fn(), log: jest.fn() },
}));
jest.mock('../../config/configuration', () => ({
  readNxJson: jest.fn(),
}));
jest.mock('./safe-prompt', () => ({
  migratePrompt: jest.fn(),
}));

import { readNxJson } from '../../config/configuration';
import {
  getGitCurrentBranch,
  getGitRemoteNames,
  hasUncommittedChanges,
  tryCommitChanges,
} from '../../utils/git-utils';
import { logger } from '../../utils/logger';
import { output } from '../../utils/output';
import {
  commitCheckpointBeforeMigrations,
  commitMigrationIfRequested,
  confirmMigrationCommitsOnDefaultBranch,
} from './migrate-commits';
import { migratePrompt } from './safe-prompt';

const mockHas = hasUncommittedChanges as jest.Mock;
const mockTry = tryCommitChanges as jest.Mock;
const mockInfo = logger.info as jest.Mock;
const mockWarn = output.warn as jest.Mock;
const mockLog = output.log as jest.Mock;
const mockCurrentBranch = getGitCurrentBranch as jest.Mock;
const mockRemoteNames = getGitRemoteNames as jest.Mock;
const mockReadNxJson = readNxJson as jest.Mock;
const mockMigratePrompt = migratePrompt as jest.Mock;

const ROOT = '/workspace';
const PREFIX = 'chore: [nx migration] ';
const installDeps = jest.fn().mockResolvedValue(undefined);

// picocolors wraps logger output in ANSI escapes when the runtime detects a
// TTY. Strip them in snapshot assertions so the snapshot reads as the
// intended message rather than a tangle of escape codes.
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;
const stripAnsi = (s: string): string => s.replace(ANSI_RE, '');

beforeEach(() => {
  mockHas.mockReset();
  mockTry.mockReset();
  mockInfo.mockReset();
  mockWarn.mockReset();
  mockLog.mockReset();
  mockCurrentBranch.mockReset();
  mockRemoteNames.mockReset().mockReturnValue([]);
  mockReadNxJson.mockReset().mockReturnValue({});
  mockMigratePrompt.mockReset().mockResolvedValue({ proceed: true });
  installDeps.mockReset();
  installDeps.mockResolvedValue(undefined);
});

describe('commitMigrationIfRequested', () => {
  it('returns disabled and skips work when shouldCreateCommits is false', async () => {
    const result = await commitMigrationIfRequested(
      ROOT,
      { name: 'm1' },
      false,
      PREFIX,
      installDeps
    );
    expect(result).toEqual({ status: 'disabled' });
    expect(installDeps).not.toHaveBeenCalled();
    expect(mockHas).not.toHaveBeenCalled();
    expect(mockTry).not.toHaveBeenCalled();
  });

  it('runs installDeps before checking for uncommitted changes', async () => {
    let installFinished = false;
    installDeps.mockImplementation(async () => {
      installFinished = true;
    });
    mockHas.mockImplementation(() => {
      expect(installFinished).toBe(true);
      return false;
    });

    await commitMigrationIfRequested(
      ROOT,
      { name: 'm1' },
      true,
      PREFIX,
      installDeps
    );
    expect(installDeps).toHaveBeenCalledTimes(1);
    // The embedded expect in mockHas never fires if the mock never runs,
    // so assert call count to catch a short-circuit before that point.
    expect(mockHas).toHaveBeenCalledTimes(1);
  });

  it('returns no-changes and logs a neutral no-op message when there are no uncommitted changes', async () => {
    mockHas.mockReturnValue(false);

    const result = await commitMigrationIfRequested(
      ROOT,
      { name: 'm1' },
      true,
      PREFIX,
      installDeps
    );
    expect(result).toEqual({ status: 'no-changes' });
    expect(mockTry).not.toHaveBeenCalled();
    expect(stripAnsi(mockInfo.mock.calls[0][0])).toMatchInlineSnapshot(
      `"- No changes to commit for m1."`
    );
  });

  it('returns the new sha and uses `<prefix><name>` as the commit subject on success', async () => {
    mockHas.mockReturnValue(true);
    mockTry.mockReturnValue('abc123');

    const result = await commitMigrationIfRequested(
      ROOT,
      { name: 'm1' },
      true,
      PREFIX,
      installDeps
    );
    expect(result).toEqual({ status: 'committed', sha: 'abc123' });
    // The scratch exclusion rides on every migration commit so `git add -A`
    // cannot capture run state even when its ignore rule went missing mid-run.
    expect(mockTry).toHaveBeenCalledWith(`${PREFIX}m1`, ROOT, [
      '.nx/migrate-runs',
    ]);
  });

  it('annotates the commit body with the package: name of prior migrations whose commits failed', async () => {
    mockHas.mockReturnValue(true);
    mockTry.mockReturnValue('def456');

    const result = await commitMigrationIfRequested(
      ROOT,
      { name: 'm4' },
      true,
      PREFIX,
      installDeps,
      [
        { package: '@nx/react', name: 'm2' },
        { package: '@nx/angular', name: 'm3' },
      ]
    );
    expect(result).toEqual({ status: 'committed', sha: 'def456' });
    expect(mockTry.mock.calls[0][0]).toMatchInlineSnapshot(`
      "chore: [nx migration] m4

      Includes changes from prior migrations whose own commits failed:
        - @nx/react: m2
        - @nx/angular: m3"
    `);
  });

  it('strips embedded newlines from migration names so hostile entries cannot inject body lines', async () => {
    mockHas.mockReturnValue(true);
    mockTry.mockReturnValue('def456');

    await commitMigrationIfRequested(
      ROOT,
      { name: 'm4' },
      true,
      PREFIX,
      installDeps,
      [
        {
          package: '@evil/pkg',
          name: 'do-thing\nCo-Authored-By: Mallory <m@x>',
        },
      ]
    );
    expect(mockTry.mock.calls[0][0]).toMatchInlineSnapshot(`
      "chore: [nx migration] m4

      Includes changes from prior migrations whose own commits failed:
        - @evil/pkg: do-thing Co-Authored-By: Mallory <m@x>"
    `);
  });

  it('does not modify the commit message when pendingMigrationNames is empty', async () => {
    mockHas.mockReturnValue(true);
    mockTry.mockReturnValue('abc123');

    await commitMigrationIfRequested(
      ROOT,
      { name: 'm1' },
      true,
      PREFIX,
      installDeps,
      []
    );
    expect(mockTry).toHaveBeenCalledWith(`${PREFIX}m1`, ROOT, [
      '.nx/migrate-runs',
    ]);
  });

  it('returns failed with the real git stderr from tryCommitChanges; message tells the user a future commit will absorb the diff', async () => {
    mockHas.mockReturnValue(true);
    mockTry.mockImplementation(() => {
      // GPG signing failures aren't bypassed by --no-verify (unlike
      // client-side hooks).
      throw new Error('error: gpg failed to sign the data');
    });

    const result = await commitMigrationIfRequested(
      ROOT,
      { name: 'm1' },
      true,
      PREFIX,
      installDeps
    );
    expect(result).toEqual({
      status: 'failed',
      reason: expect.stringContaining('gpg failed to sign'),
    });
    expect(stripAnsi(mockInfo.mock.calls[0][0])).toMatchInlineSnapshot(`
      "Could not create a commit for m1:
      error: gpg failed to sign the data
      The migration's diff remains in the working tree; inspect with \`git status\` / \`git diff\` to review. The next successful commit will absorb it and reference this migration in its body; if no later commit lands, the end-of-run output will list this migration so you can commit or revert manually."
    `);
  });

  it('honestly reports that the commit landed when tryCommitChanges returns without a sha (HEAD-resolve race)', async () => {
    // `tryCommitChanges` returns null (not throws) — by contract this means
    // the commit landed but `git rev-parse HEAD` failed transiently. The
    // result is still `committed` (with a null sha) so the executor knows the
    // diff cleared, not `failed` which would push it into pending.
    mockHas.mockReturnValue(true);
    mockTry.mockReturnValue(null);

    const result = await commitMigrationIfRequested(
      ROOT,
      { name: 'm1' },
      true,
      PREFIX,
      installDeps
    );
    expect(result).toEqual({ status: 'committed', sha: null });
    expect(stripAnsi(mockInfo.mock.calls[0][0])).toMatchInlineSnapshot(
      `"The commit for m1 was created, but its sha could not be resolved (\`git rev-parse HEAD\` failed transiently). Continuing without recording the sha for this step."`
    );
  });
});

describe('commitCheckpointBeforeMigrations', () => {
  it('does nothing when the working tree is clean', () => {
    mockHas.mockReturnValue(false);

    commitCheckpointBeforeMigrations(ROOT, PREFIX);
    expect(mockTry).not.toHaveBeenCalled();
    expect(mockInfo).not.toHaveBeenCalled();
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('creates the checkpoint commit and logs the sha when the working tree is dirty', () => {
    mockHas.mockReturnValue(true);
    mockTry.mockReturnValue('chk456');

    commitCheckpointBeforeMigrations(ROOT, PREFIX);
    expect(mockTry).toHaveBeenCalledWith(
      `${PREFIX}checkpoint before running migrations`,
      ROOT,
      ['.nx/migrate-runs']
    );
    expect(stripAnsi(mockInfo.mock.calls[0][0])).toMatchInlineSnapshot(
      `"- Checkpoint commit created: chk456"`
    );
  });

  it('surfaces the real git stderr as a warning when the checkpoint commit fails', () => {
    mockHas.mockReturnValue(true);
    mockTry.mockImplementation(() => {
      throw new Error('error: gpg failed to sign the data');
    });

    commitCheckpointBeforeMigrations(ROOT, PREFIX);
    expect(mockWarn).toHaveBeenCalledTimes(1);
    const warnArg = mockWarn.mock.calls[0][0];
    expect(warnArg.title).toBe(
      'Could not create checkpoint commit before migrations'
    );
    expect(warnArg.bodyLines).toMatchInlineSnapshot(`
      [
        "error: gpg failed to sign the data",
        "Migration 1's commit will absorb any pre-existing working-tree state.",
      ]
    `);
  });

  it('honestly reports that the checkpoint commit landed when tryCommitChanges returns without a sha (HEAD-resolve race)', () => {
    // `tryCommitChanges` returns null (not throws) — by contract the
    // checkpoint commit landed but HEAD-resolve failed transiently. We
    // must not tell the user migration 1 will absorb pre-existing state.
    mockHas.mockReturnValue(true);
    mockTry.mockReturnValue(null);

    commitCheckpointBeforeMigrations(ROOT, PREFIX);
    expect(mockWarn).toHaveBeenCalledTimes(1);
    const warnArg = mockWarn.mock.calls[0][0];
    expect(warnArg.title).toBe('Could not resolve checkpoint commit sha');
    expect(warnArg.bodyLines).toMatchInlineSnapshot(`
      [
        "The checkpoint commit was created, but its sha could not be resolved (\`git rev-parse HEAD\` failed transiently).",
      ]
    `);
  });
});

describe('confirmMigrationCommitsOnDefaultBranch', () => {
  it('prompts when the default base names a remote other than origin', async () => {
    mockRemoteNames.mockReturnValue(['upstream']);
    mockReadNxJson.mockReturnValue({ defaultBase: 'upstream/main' });
    mockCurrentBranch.mockReturnValue('main');

    await expect(
      confirmMigrationCommitsOnDefaultBranch('/workspace', 'running migrations')
    ).resolves.toBe(true);
    expect(mockMigratePrompt).toHaveBeenCalledTimes(1);
  });

  it('prompts for an origin-qualified default base even when no remote is configured', async () => {
    mockReadNxJson.mockReturnValue({ defaultBase: 'origin/main' });
    mockCurrentBranch.mockReturnValue('main');

    await expect(
      confirmMigrationCommitsOnDefaultBranch('/workspace', 'running migrations')
    ).resolves.toBe(true);
    expect(mockMigratePrompt).toHaveBeenCalledTimes(1);
  });

  it('keeps a slash in a local branch name that no remote claims', async () => {
    mockRemoteNames.mockReturnValue(['origin']);
    mockReadNxJson.mockReturnValue({ defaultBase: 'release/main' });
    mockCurrentBranch.mockReturnValue('main');

    await expect(
      confirmMigrationCommitsOnDefaultBranch('/workspace', 'running migrations')
    ).resolves.toBe(true);
    expect(mockMigratePrompt).not.toHaveBeenCalled();

    mockCurrentBranch.mockReturnValue('release/main');
    await expect(
      confirmMigrationCommitsOnDefaultBranch('/workspace', 'running migrations')
    ).resolves.toBe(true);
    expect(mockMigratePrompt).toHaveBeenCalledTimes(1);
  });

  it('prompts when a local branch is named after a remote it does not track', async () => {
    // `up/feature` is a legal local branch name while `up` is a remote, so the
    // exact match has to win before the prefix is read as a remote's.
    mockRemoteNames.mockReturnValue(['up']);
    mockReadNxJson.mockReturnValue({ defaultBase: 'up/feature' });
    mockCurrentBranch.mockReturnValue('up/feature');

    await expect(
      confirmMigrationCommitsOnDefaultBranch('/workspace', 'running migrations')
    ).resolves.toBe(true);
    expect(mockMigratePrompt).toHaveBeenCalledTimes(1);
  });

  it('strips the longest remote name when one remote name prefixes another', async () => {
    mockRemoteNames.mockReturnValue(['a', 'a/b']);
    mockReadNxJson.mockReturnValue({ defaultBase: 'a/b/main' });
    mockCurrentBranch.mockReturnValue('main');

    await expect(
      confirmMigrationCommitsOnDefaultBranch('/workspace', 'running migrations')
    ).resolves.toBe(true);
    expect(mockMigratePrompt).toHaveBeenCalledTimes(1);
  });

  it('reports the decision when the user declines', async () => {
    mockRemoteNames.mockReturnValue(['upstream']);
    mockReadNxJson.mockReturnValue({ defaultBase: 'upstream/main' });
    mockCurrentBranch.mockReturnValue('main');
    mockMigratePrompt.mockResolvedValue({ proceed: false });

    await expect(
      confirmMigrationCommitsOnDefaultBranch(
        '/workspace',
        'running the migration'
      )
    ).resolves.toBe(false);
    expect(mockLog.mock.calls[0][0].title).toContain(
      "Skipped running the migration to avoid committing to the default branch 'main'."
    );
  });
});
