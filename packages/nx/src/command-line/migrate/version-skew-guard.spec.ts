import { output } from '../../utils/output';
import {
  assertWorkspaceNxSupportsNewMigrateFlags,
  findNewMigrateFlag,
  NEW_MIGRATE_FLAGS,
  resolveNewMigrateFlagsRunTarget,
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

describe('resolveNewMigrateFlagsRunTarget', () => {
  afterEach(() => jest.restoreAllMocks());

  function target(overrides: {
    argv?: string[];
    cliVersionSpec?: string;
    fromEnvOverride?: boolean;
    ownNxVersion?: string;
    resolveVersion?: (spec: string) => Promise<string>;
    readLocalNxVersion?: () => string | undefined;
  }) {
    return resolveNewMigrateFlagsRunTarget({
      argv: ['--run-migration=@nx/js:x'],
      cliVersionSpec: 'latest',
      fromEnvOverride: false,
      ownNxVersion: '23.2.0',
      resolveVersion: jest.fn().mockResolvedValue('23.2.0'),
      readLocalNxVersion: () => '23.2.0',
      ...overrides,
    });
  }

  it('routes to the temp CLI without resolving anything when no new flag is present', async () => {
    const resolveVersion = jest.fn();
    const readLocalNxVersion = jest.fn();
    await expect(
      target({ argv: ['nx@latest'], resolveVersion, readLocalNxVersion })
    ).resolves.toBe('temp-cli');
    expect(resolveVersion).not.toHaveBeenCalled();
    expect(readLocalNxVersion).not.toHaveBeenCalled();
  });

  it('routes to the temp CLI when the resolved version is at or above the floor', async () => {
    for (const resolved of ['23.2.0', '23.2.1', '23.3.0-beta.1', '24.0.0']) {
      await expect(
        target({ resolveVersion: jest.fn().mockResolvedValue(resolved) })
      ).resolves.toBe('temp-cli');
    }
  });

  it('treats a 23.2.0 prerelease as below the floor (published prereleases may predate the feature)', async () => {
    await expect(
      target({
        resolveVersion: jest.fn().mockResolvedValue('23.2.0-beta.1'),
        readLocalNxVersion: () => '23.2.0',
      })
    ).resolves.toBe('local-nx');
  });

  it('does not resolve an already-concrete spec, including v-prefixed', async () => {
    const resolveVersion = jest.fn();
    await expect(
      target({ cliVersionSpec: 'v23.2.0', resolveVersion })
    ).resolves.toBe('temp-cli');
    expect(resolveVersion).not.toHaveBeenCalled();
  });

  it('falls back to a capable local nx when the temp CLI resolves below the floor', async () => {
    const resolveVersion = jest.fn().mockResolvedValue('23.1.0');
    await expect(
      target({ resolveVersion, readLocalNxVersion: () => '23.2.0' })
    ).resolves.toBe('local-nx');
    expect(resolveVersion).toHaveBeenCalledWith('latest');
  });

  it('falls back to a local nx that matches the running version, even below the floor', async () => {
    // The running nx parsed the flag, so an identical local install supports
    // it too; this keeps prerelease dogfooding via npx working.
    await expect(
      target({
        resolveVersion: jest.fn().mockResolvedValue('23.1.0'),
        ownNxVersion: '23.2.0-canary.20260720',
        readLocalNxVersion: () => '23.2.0-canary.20260720',
      })
    ).resolves.toBe('local-nx');
  });

  it('falls back to a local nx at the floor even when it differs from the running version', async () => {
    await expect(
      target({
        resolveVersion: jest.fn().mockResolvedValue('23.1.0'),
        ownNxVersion: '23.3.0',
        readLocalNxVersion: () => '23.2.0',
      })
    ).resolves.toBe('local-nx');
  });

  it('refuses when the local nx version cannot be read and the temp CLI is below the floor', async () => {
    await expect(
      target({
        resolveVersion: jest.fn().mockResolvedValue('23.1.0'),
        readLocalNxVersion: () => undefined,
      })
    ).rejects.toThrow(/installed nx version could not be read/);
  });

  it('falls back to a capable local nx when resolution fails (registry error or minimum-release-age violation)', async () => {
    await expect(
      target({
        resolveVersion: jest
          .fn()
          .mockRejectedValue(new Error('registry lookup failed')),
        readLocalNxVersion: () => '23.2.0',
      })
    ).resolves.toBe('local-nx');
  });

  it('refuses when neither the temp CLI nor the local nx supports the flag', async () => {
    const promise = target({
      resolveVersion: jest.fn().mockResolvedValue('23.1.0'),
      ownNxVersion: '23.2.0',
      readLocalNxVersion: () => '22.5.0',
    });
    await expect(promise).rejects.toThrow(
      /--run-migration requires nx 23\.2\.0 or newer/
    );
    await expect(promise).rejects.toThrow(/resolves to 23\.1\.0/);
    await expect(promise).rejects.toThrow(/installed nx \(22\.5\.0\)/);
    await expect(promise).rejects.toThrow(/Update the workspace/);
    // The remediation names the idiomatic update command; it must not point
    // at NX_MIGRATE_USE_LOCAL, which would hand the flag to an nx that
    // silently drops it.
    await expect(promise).rejects.toThrow(/nx migrate nx@latest/);
    const error = await promise.catch((e) => e);
    expect(error.message).not.toMatch(/NX_MIGRATE_USE_LOCAL/);
  });

  it('refuses naming the failed resolution when it fails and the local nx is also too old', async () => {
    await expect(
      target({
        resolveVersion: jest.fn().mockRejectedValue(new Error('boom')),
        readLocalNxVersion: () => '22.5.0',
      })
    ).rejects.toThrow(/could not be resolved/);
  });

  it('refuses an explicit NX_MIGRATE_CLI_VERSION below the floor instead of overriding the pin', async () => {
    const promise = target({
      cliVersionSpec: '23.1.0',
      fromEnvOverride: true,
      // A concrete spec needs no resolution; a capable local nx must not
      // silently win over the user's explicit pin.
      resolveVersion: jest.fn(),
      readLocalNxVersion: () => '24.0.0',
    });
    await expect(promise).rejects.toThrow(
      "NX_MIGRATE_CLI_VERSION is set to '23.1.0'. Unset it or set it to nx 23.2.0 or newer."
    );
  });

  it('still falls back to the local nx when an env-pinned spec fails to resolve, warning that the pin was not honored', async () => {
    const warnSpy = jest.spyOn(output, 'warn').mockImplementation(() => {});
    await expect(
      target({
        cliVersionSpec: 'next',
        fromEnvOverride: true,
        resolveVersion: jest.fn().mockRejectedValue(new Error('boom')),
        readLocalNxVersion: () => '23.2.0',
      })
    ).resolves.toBe('local-nx');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("NX_MIGRATE_CLI_VERSION ('next')"),
      })
    );
  });

  it('does not warn when the default spec fails to resolve and the local fallback applies', async () => {
    const warnSpy = jest.spyOn(output, 'warn').mockImplementation(() => {});
    await expect(
      target({
        resolveVersion: jest.fn().mockRejectedValue(new Error('boom')),
        readLocalNxVersion: () => '23.2.0',
      })
    ).resolves.toBe('local-nx');
    expect(warnSpy).not.toHaveBeenCalled();
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

  it('refuses a 23.2.0 prerelease (below the final-release floor)', () => {
    expect(() =>
      assertWorkspaceNxSupportsNewMigrateFlags({
        argv: ['--run-migration=@nx/js:x'],
        readLocalNxVersion: () => '23.2.0-beta.0',
      })
    ).toThrow(/does not support --run-migration/);
  });

  it('passes when the local nx is at or above the floor', () => {
    for (const version of ['23.2.0', '23.2.1', '24.0.0']) {
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
