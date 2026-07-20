import {
  assertTempCliSupportsNewMigrateFlags,
  assertWorkspaceNxSupportsNewMigrateFlags,
  findNewMigrateFlag,
  NEW_MIGRATE_FLAGS,
} from './version-skew-guard';

describe('findNewMigrateFlag', () => {
  it.each(NEW_MIGRATE_FLAGS)('matches the exact flag %s', (flag) => {
    expect(findNewMigrateFlag(['migrate', flag])).toBe(flag);
  });

  it.each(NEW_MIGRATE_FLAGS)('matches %s with an inline value', (flag) => {
    expect(findNewMigrateFlag([`${flag}=some-value`])).toBe(flag);
  });

  it('does not match --run-migrations (trailing s), exact or with a value', () => {
    expect(findNewMigrateFlag(['--run-migrations'])).toBeUndefined();
    expect(
      findNewMigrateFlag(['--run-migrations=migrations.json'])
    ).toBeUndefined();
    expect(findNewMigrateFlag(['--runMigrations'])).toBeUndefined();
  });

  it('returns undefined when no new flag is present', () => {
    expect(findNewMigrateFlag([])).toBeUndefined();
    expect(
      findNewMigrateFlag(['nx@latest', '--from=nx@22.0.0'])
    ).toBeUndefined();
  });

  it('returns the first matching flag among several args', () => {
    expect(
      findNewMigrateFlag(['--verbose', '--runMigration=x', '--run-migration=x'])
    ).toBe('--runMigration');
  });

  it('ignores everything after the -- separator', () => {
    expect(findNewMigrateFlag(['--', '--run-migration=x'])).toBeUndefined();
    expect(
      findNewMigrateFlag(['--verbose', '--', '--run-migration=x'])
    ).toBeUndefined();
    expect(
      findNewMigrateFlag(['--runMigration=x', '--', '--run-migration=x'])
    ).toBe('--runMigration');
  });
});

describe('assertTempCliSupportsNewMigrateFlags', () => {
  it('does nothing and never resolves when no new flag is present', async () => {
    const resolveVersion = jest.fn();
    await expect(
      assertTempCliSupportsNewMigrateFlags({
        argv: ['nx@latest'],
        cliVersionSpec: 'latest',
        fromEnvOverride: false,
        resolveVersion,
      })
    ).resolves.toBeUndefined();
    expect(resolveVersion).not.toHaveBeenCalled();
  });

  it('refuses when latest resolves below the floor', async () => {
    const resolveVersion = jest.fn().mockResolvedValue('23.1.0');
    await expect(
      assertTempCliSupportsNewMigrateFlags({
        argv: ['--run-migration=@nx/js:x'],
        cliVersionSpec: 'latest',
        fromEnvOverride: false,
        resolveVersion,
      })
    ).rejects.toThrow(
      "The nx version 'nx migrate' is about to install (23.1.0) does not support --run-migration. This flag ships in nx 23.2.0 or newer."
    );
    expect(resolveVersion).toHaveBeenCalledWith('latest');
  });

  it('does not mention NX_MIGRATE_CLI_VERSION when latest is the source', async () => {
    await expect(
      assertTempCliSupportsNewMigrateFlags({
        argv: ['--run-migration=@nx/js:x'],
        cliVersionSpec: 'latest',
        fromEnvOverride: false,
        resolveVersion: jest.fn().mockResolvedValue('23.1.0'),
      })
    ).rejects.not.toThrow(/NX_MIGRATE_CLI_VERSION/);
  });

  it('mentions NX_MIGRATE_CLI_VERSION when it is the source', async () => {
    await expect(
      assertTempCliSupportsNewMigrateFlags({
        argv: ['--run-migration=@nx/js:x'],
        cliVersionSpec: '23.1.0',
        fromEnvOverride: true,
        // A concrete spec needs no resolution.
        resolveVersion: jest.fn(),
      })
    ).rejects.toThrow(
      "NX_MIGRATE_CLI_VERSION is set to '23.1.0'. Unset it or set it to nx 23.2.0 or newer."
    );
  });

  it('does not resolve an already-concrete spec', async () => {
    const resolveVersion = jest.fn();
    await expect(
      assertTempCliSupportsNewMigrateFlags({
        argv: ['--run-migration=@nx/js:x'],
        cliVersionSpec: '23.1.0',
        fromEnvOverride: true,
        resolveVersion,
      })
    ).rejects.toThrow(/does not support --run-migration/);
    expect(resolveVersion).not.toHaveBeenCalled();
  });

  it('passes at the floor (its prerelease) and above', async () => {
    for (const resolved of ['23.2.0-beta.0', '23.2.0', '23.3.0-beta.1']) {
      await expect(
        assertTempCliSupportsNewMigrateFlags({
          argv: ['--run-migration=@nx/js:x'],
          cliVersionSpec: 'next',
          fromEnvOverride: false,
          resolveVersion: jest.fn().mockResolvedValue(resolved),
        })
      ).resolves.toBeUndefined();
    }
  });

  it('accepts a v-prefixed concrete spec at or above the floor without resolving', async () => {
    const resolveVersion = jest.fn();
    await expect(
      assertTempCliSupportsNewMigrateFlags({
        argv: ['--run-migration=@nx/js:x'],
        cliVersionSpec: 'v23.2.0',
        fromEnvOverride: true,
        resolveVersion,
      })
    ).resolves.toBeUndefined();
    expect(resolveVersion).not.toHaveBeenCalled();
  });

  it('skips the guard when resolution fails, leaving the local-nx fallback reachable', async () => {
    await expect(
      assertTempCliSupportsNewMigrateFlags({
        argv: ['--run-migration=@nx/js:x'],
        cliVersionSpec: 'latest',
        fromEnvOverride: false,
        resolveVersion: jest
          .fn()
          .mockRejectedValue(new Error('registry lookup failed')),
      })
    ).resolves.toBeUndefined();
  });
});

describe('assertWorkspaceNxSupportsNewMigrateFlags', () => {
  it('does nothing and never reads the version when no new flag is present', () => {
    const readLocalNxVersion = jest.fn();
    expect(() =>
      assertWorkspaceNxSupportsNewMigrateFlags({
        argv: ['nx@latest'],
        readLocalNxVersion,
      })
    ).not.toThrow();
    expect(readLocalNxVersion).not.toHaveBeenCalled();
  });

  it('refuses when the local nx is below the floor, with an update hint', () => {
    expect(() =>
      assertWorkspaceNxSupportsNewMigrateFlags({
        argv: ['--run-migration=@nx/js:x'],
        readLocalNxVersion: () => '22.5.0',
      })
    ).toThrow(
      "The workspace's installed nx (22.5.0) does not support --run-migration. Update the workspace to nx 23.2.0 or newer first, for example by running 'nx migrate nx@latest' (without --run-migration) or by updating your dependencies."
    );
  });

  it('passes when the local nx is at or above the floor', () => {
    for (const version of ['23.2.0-beta.0', '23.2.0', '24.0.0']) {
      expect(() =>
        assertWorkspaceNxSupportsNewMigrateFlags({
          argv: ['--run-migration=@nx/js:x'],
          readLocalNxVersion: () => version,
        })
      ).not.toThrow();
    }
  });

  it('does not block when the local nx version cannot be read', () => {
    expect(() =>
      assertWorkspaceNxSupportsNewMigrateFlags({
        argv: ['--run-migration=@nx/js:x'],
        readLocalNxVersion: () => undefined,
      })
    ).not.toThrow();
  });
});
