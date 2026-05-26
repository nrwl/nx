jest.mock('../../utils/git-utils', () => ({
  hasUncommittedChanges: jest.fn(),
  tryCommitChanges: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn() },
}));
jest.mock('../../utils/output', () => ({
  output: { warn: jest.fn() },
}));

import { hasUncommittedChanges, tryCommitChanges } from '../../utils/git-utils';
import { logger } from '../../utils/logger';
import { output } from '../../utils/output';
import {
  commitCheckpointBeforeMigrations,
  commitMigrationIfRequested,
} from './migrate-commits';

const mockHas = hasUncommittedChanges as jest.Mock;
const mockTry = tryCommitChanges as jest.Mock;
const mockInfo = logger.info as jest.Mock;
const mockWarn = output.warn as jest.Mock;

const ROOT = '/workspace';
const PREFIX = 'chore: [nx migration] ';
const installDeps = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  mockHas.mockReset();
  mockTry.mockReset();
  mockInfo.mockReset();
  mockWarn.mockReset();
  installDeps.mockReset();
  installDeps.mockResolvedValue(undefined);
});

describe('commitMigrationIfRequested', () => {
  it('returns null and skips work when shouldCreateCommits is false', async () => {
    const sha = await commitMigrationIfRequested(
      ROOT,
      { name: 'm1' },
      false,
      PREFIX,
      installDeps
    );
    expect(sha).toBeNull();
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
  });

  it('returns null and logs a neutral no-op message when there are no uncommitted changes', async () => {
    mockHas.mockReturnValue(false);

    const sha = await commitMigrationIfRequested(
      ROOT,
      { name: 'm1' },
      true,
      PREFIX,
      installDeps
    );
    expect(sha).toBeNull();
    expect(mockTry).not.toHaveBeenCalled();
    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining('No changes to commit for m1')
    );
  });

  it('returns the new sha and uses `<prefix><name>` as the commit message on success', async () => {
    mockHas.mockReturnValue(true);
    mockTry.mockReturnValue('abc123');

    const sha = await commitMigrationIfRequested(
      ROOT,
      { name: 'm1' },
      true,
      PREFIX,
      installDeps
    );
    expect(sha).toBe('abc123');
    expect(mockTry).toHaveBeenCalledWith(`${PREFIX}m1`, ROOT);
  });

  it('surfaces the real git stderr from tryCommitChanges and mentions the diff stays in the working tree', async () => {
    mockHas.mockReturnValue(true);
    mockTry.mockImplementation(() => {
      throw new Error('hook rejected: signed commits required');
    });

    const sha = await commitMigrationIfRequested(
      ROOT,
      { name: 'm1' },
      true,
      PREFIX,
      installDeps
    );
    expect(sha).toBeNull();
    const message = mockInfo.mock.calls[0][0] as string;
    expect(message).toContain('hook rejected: signed commits required');
    expect(message).toContain('remains in the working tree');
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
      ROOT
    );
    expect(mockInfo).toHaveBeenCalledWith(expect.stringContaining('chk456'));
  });

  it('surfaces the real git stderr as a warning when the checkpoint commit fails', () => {
    mockHas.mockReturnValue(true);
    mockTry.mockImplementation(() => {
      throw new Error('error: gpg failed to sign the data');
    });

    commitCheckpointBeforeMigrations(ROOT, PREFIX);
    expect(mockWarn).toHaveBeenCalledTimes(1);
    const warnArg = mockWarn.mock.calls[0][0];
    expect(warnArg.title).toContain('Could not create checkpoint commit');
    expect(warnArg.bodyLines.join('\n')).toContain('gpg failed to sign');
    expect(warnArg.bodyLines.join('\n')).toContain(
      "Migration 1's commit will absorb"
    );
  });
});
