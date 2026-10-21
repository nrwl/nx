// Kept apart from migrate-commits.spec.ts, which mocks the git helpers: these
// cases check what actually lands in the commits.

import { execSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  commitCheckpointBeforeMigrations,
  commitMigrationIfRequested,
} from './migrate-commits';

const PREFIX = 'chore: [nx migration] ';
const PROMPT = 'tools/ai-migrations/MIGRATE_DEMO.md';

function git(cwd: string, command: string): string {
  return execSync(`git ${command}`, {
    encoding: 'utf8',
    stdio: 'pipe',
    cwd,
    windowsHide: true,
  });
}

function committedPaths(cwd: string): string[] {
  return git(cwd, 'ls-tree -r --name-only HEAD').trim().split('\n');
}

function commitMigration(root: string) {
  return commitMigrationIfRequested(
    root,
    { name: 'm1' },
    true,
    PREFIX,
    async () => {}
  );
}

describe('migrate commits (real git)', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-migrate-commits-'));
    // The code under test spawns git with process.env, so the developer's git
    // config and inherited GIT_* variables would reach it too.
    for (const key of Object.keys(process.env)) {
      if (/^GIT_/i.test(key)) vi.stubEnv(key, undefined);
    }
    vi.stubEnv('GIT_CONFIG_GLOBAL', join(root, 'no-such-gitconfig'));
    vi.stubEnv('GIT_CONFIG_SYSTEM', join(root, 'no-such-gitconfig'));
    vi.stubEnv('GIT_CONFIG_COUNT', '1');
    vi.stubEnv('GIT_CONFIG_KEY_0', 'core.excludesFile');
    vi.stubEnv('GIT_CONFIG_VALUE_0', join(root, 'no-such-gitignore'));
    git(root, 'init -q');
    git(root, 'config user.email test@test');
    git(root, 'config user.name test');
    git(root, 'config commit.gpgsign false');
    writeFileSync(join(root, 'package.json'), '{}');
    git(root, 'add -A');
    git(root, 'commit -q --no-verify -m init');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  });

  it.each([
    [
      'the checkpoint',
      async (root: string) => commitCheckpointBeforeMigrations(root, PREFIX),
    ],
    ['a migration commit', commitMigration],
  ])(
    'leaves a staged plan and prompt files that HEAD lacks out of %s',
    async (_, commit) => {
      writeFileSync(join(root, 'migrations.json'), '{}');
      mkdirSync(join(root, 'tools/ai-migrations'), { recursive: true });
      writeFileSync(join(root, PROMPT), 'prompt');
      writeFileSync(join(root, 'package.json'), '{"name":"ws"}');
      git(root, 'add -A');

      await commit(root);

      expect(git(root, 'show HEAD:package.json')).toBe('{"name":"ws"}');
      expect(committedPaths(root)).toEqual(['package.json']);
    }
  );

  it('commits the staged deletion of a plan HEAD already has', async () => {
    writeFileSync(join(root, 'migrations.json'), '{}');
    git(root, 'add -A');
    git(root, 'commit -q --no-verify -m plan');
    git(root, 'rm -q migrations.json');

    await commitMigration(root);

    expect(committedPaths(root)).toEqual(['package.json']);
  });

  it('reports no changes when only unignored scratch files are dirty', async () => {
    mkdirSync(join(root, '.nx/migrate-runs/run-1'), { recursive: true });
    writeFileSync(join(root, '.nx/migrate-runs/run-1/run.json'), '{}');
    expect(git(root, 'status --porcelain')).toBe('?? .nx/\n');

    const result = await commitMigration(root);

    expect(result).toEqual({ status: 'no-changes' });
  });
});
