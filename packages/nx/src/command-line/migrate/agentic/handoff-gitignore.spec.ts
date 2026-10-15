import type { Mock } from 'vitest';
vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn() },
}));

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { logger } from '../../../utils/logger';
import { applyAgenticHandoffGitignoreFallback } from './handoff-gitignore';
import { isHandoffGitignoreMigration } from './types';

const mockInfo = logger.info as Mock;

const HANDOFF_GITIGNORE_MIGRATION = {
  package: 'nx',
  name: '23-0-0-add-migrate-runs-to-git-ignore',
  version: '23.0.0-beta.18',
};

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
    mockInfo.mockReset();
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('does nothing when the migration is not in the queue and installed nx is at v23+ (respect conscious removal)', async () => {
    writeFileSync(gitignorePath(), 'node_modules\n');
    await applyAgenticHandoffGitignoreFallback({
      migrations: [{ package: '@nx/react', name: 'some-23-mig' }],
      installedNxVersion: '23.2.0',
      root: workspace,
    });
    expect(readFileSync(gitignorePath(), 'utf-8')).toBe('node_modules\n');
    expect(mockInfo).not.toHaveBeenCalled();
  });

  it('treats a v23 prerelease (e.g. 23.0.0-beta.1) installed as "past v23" — the major check is intentional', async () => {
    writeFileSync(gitignorePath(), 'node_modules\n');
    await applyAgenticHandoffGitignoreFallback({
      migrations: [{ package: '@nx/react', name: 'some-mig' }],
      installedNxVersion: '23.0.0-beta.1',
      root: workspace,
    });
    expect(readFileSync(gitignorePath(), 'utf-8')).toBe('node_modules\n');
  });

  it('applies the gitignore entry inline when installed nx < v23', async () => {
    writeFileSync(gitignorePath(), 'node_modules\n');

    await applyAgenticHandoffGitignoreFallback({
      migrations: [{ package: '@nx/react', name: 'some-22-mig' }],
      installedNxVersion: '22.5.0',
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
    const messages = mockInfo.mock.calls.map((c) => stripAnsi(c[0]));
    expect(messages).toEqual([
      `- Added .nx/migrate-runs to .gitignore so this run's scratch state is ignored.`,
    ]);
  });

  it('is a no-op when the entry is already covered by an existing pattern', async () => {
    writeFileSync(gitignorePath(), 'node_modules\n.nx\n');
    await applyAgenticHandoffGitignoreFallback({
      migrations: [{ package: '@nx/react', name: 'some-22-mig' }],
      installedNxVersion: '22.5.0',
      root: workspace,
    });
    expect(readFileSync(gitignorePath(), 'utf-8')).toBe('node_modules\n.nx\n');
    expect(mockInfo).not.toHaveBeenCalled();
  });
});
