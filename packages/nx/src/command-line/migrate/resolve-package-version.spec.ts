jest.mock('../../config/configuration', () => ({
  readNxJson: jest.fn(() => ({})),
}));
jest.mock('../../utils/catalog', () => ({
  resolveCatalogReferenceIfNeeded: jest.fn((_pkg, version) => version),
}));
jest.mock('../../utils/package-manager', () => ({
  resolvePackageVersionUsingRegistry: jest.fn(),
  resolvePackageVersionUsingInstallation: jest.fn(),
}));
jest.mock('../../utils/min-release-age/policy', () => ({
  readMinReleaseAgePolicy: jest.fn(),
}));
jest.mock('../../utils/min-release-age/resolve', () => ({
  resolveCompliantVersion: jest.fn(),
}));
jest.mock('../../utils/min-release-age/pnpm-exclude-writer', () => ({
  appendMinimumReleaseAgeExcludes: jest.fn(),
}));
jest.mock('./safe-prompt', () => ({
  migratePrompt: jest.fn(),
}));

import { readNxJson } from '../../config/configuration';
import {
  resolvePackageVersionUsingInstallation,
  resolvePackageVersionUsingRegistry,
} from '../../utils/package-manager';
import { MinReleaseAgeViolationError } from '../../utils/min-release-age/errors';
import { readMinReleaseAgePolicy } from '../../utils/min-release-age/policy';
import { appendMinimumReleaseAgeExcludes } from '../../utils/min-release-age/pnpm-exclude-writer';
import { resolveCompliantVersion } from '../../utils/min-release-age/resolve';
import { migratePrompt } from './safe-prompt';
import {
  isRegistryResolutionEnabled,
  resetResolvePackageVersionState,
  resolvePackageVersionRespectingMinReleaseAge,
} from './resolve-package-version';

const mockReadNxJson = readNxJson as jest.Mock;
const mockUsingRegistry = resolvePackageVersionUsingRegistry as jest.Mock;
const mockUsingInstall = resolvePackageVersionUsingInstallation as jest.Mock;
const mockReadPolicy = readMinReleaseAgePolicy as jest.Mock;
const mockResolve = resolveCompliantVersion as jest.Mock;
const mockWriteExcludes = appendMinimumReleaseAgeExcludes as jest.Mock;
const mockPrompt = migratePrompt as jest.Mock;

function pnpmPolicy(
  overrides: Partial<{
    strict: boolean;
    writesExcludes: boolean;
  }> = {}
) {
  return {
    outcome: 'active',
    policy: {
      packageManager: 'pnpm',
      packageManagerVersion: '11.5.2',
      cutoffMs: 0,
      windowMs: 1440 * 60 * 1000,
      sourceDescription: 'pnpm minimumReleaseAge (1440 min, default)',
      isExcluded: () => false,
      behavior: {
        packageManager: 'pnpm',
        strict: overrides.strict ?? false,
        looseFallback: true,
        writesExcludes: overrides.writesExcludes ?? true,
        missingTimeMap: 'skip',
      },
    },
  };
}

function violation(blocked: { version: string; publishedAt: string }[]) {
  return new MinReleaseAgeViolationError({
    packageManager: 'pnpm',
    packageName: 'pkg-a',
    spec: '^2.0.0',
    pmShapedDetail: 'no mature matching version',
    blocked,
    remediation: [],
  });
}

describe('isRegistryResolutionEnabled', () => {
  const originalEnv = { ...process.env };
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    resetResolvePackageVersionState();
    warnSpy = jest
      .spyOn(require('../../utils/output').output, 'warn')
      .mockImplementation(() => {});
    delete process.env.NX_MIGRATE_USE_REGISTRY_RESOLUTION;
    delete process.env.NX_MIGRATE_SKIP_REGISTRY_FETCH;
    mockReadNxJson.mockReturnValue({});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    process.env = { ...originalEnv };
  });

  it('defaults to true', () => {
    expect(isRegistryResolutionEnabled()).toBe(true);
  });

  it('honors the nx.json migrate.useRegistryResolution setting', () => {
    mockReadNxJson.mockReturnValue({
      migrate: { useRegistryResolution: false },
    });
    expect(isRegistryResolutionEnabled()).toBe(false);
  });

  it('legacy NX_MIGRATE_SKIP_REGISTRY_FETCH=true disables, overriding nx.json', () => {
    mockReadNxJson.mockReturnValue({
      migrate: { useRegistryResolution: true },
    });
    process.env.NX_MIGRATE_SKIP_REGISTRY_FETCH = 'true';
    expect(isRegistryResolutionEnabled()).toBe(false);
  });

  it('legacy NX_MIGRATE_SKIP_REGISTRY_FETCH=false enables', () => {
    process.env.NX_MIGRATE_SKIP_REGISTRY_FETCH = 'false';
    expect(isRegistryResolutionEnabled()).toBe(true);
  });

  it('new NX_MIGRATE_USE_REGISTRY_RESOLUTION wins over the legacy env', () => {
    process.env.NX_MIGRATE_USE_REGISTRY_RESOLUTION = 'true';
    process.env.NX_MIGRATE_SKIP_REGISTRY_FETCH = 'true';
    expect(isRegistryResolutionEnabled()).toBe(true);

    process.env.NX_MIGRATE_USE_REGISTRY_RESOLUTION = 'false';
    process.env.NX_MIGRATE_SKIP_REGISTRY_FETCH = 'false';
    expect(isRegistryResolutionEnabled()).toBe(false);
  });

  it('warns once when the legacy env var is set, pointing to the replacement', () => {
    process.env.NX_MIGRATE_SKIP_REGISTRY_FETCH = 'true';

    isRegistryResolutionEnabled();
    isRegistryResolutionEnabled();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0].title).toContain(
      'NX_MIGRATE_SKIP_REGISTRY_FETCH is deprecated'
    );
    expect(warnSpy.mock.calls[0][0].bodyLines.join(' ')).toContain(
      'NX_MIGRATE_USE_REGISTRY_RESOLUTION'
    );
  });

  it('does not warn when the legacy env var is unset', () => {
    isRegistryResolutionEnabled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('notes the override when the new env var is also set', () => {
    process.env.NX_MIGRATE_SKIP_REGISTRY_FETCH = 'true';
    process.env.NX_MIGRATE_USE_REGISTRY_RESOLUTION = 'false';

    isRegistryResolutionEnabled();

    expect(warnSpy.mock.calls[0][0].bodyLines.join(' ')).toContain(
      'being overridden by NX_MIGRATE_USE_REGISTRY_RESOLUTION'
    );
  });
});

describe('resolvePackageVersionRespectingMinReleaseAge', () => {
  const originalEnv = { ...process.env };
  let originalIsTTY: unknown;

  beforeEach(() => {
    resetResolvePackageVersionState();
    jest.clearAllMocks();
    delete process.env.NX_MIGRATE_USE_REGISTRY_RESOLUTION;
    delete process.env.NX_MIGRATE_SKIP_REGISTRY_FETCH;
    delete process.env.CI;
    mockReadNxJson.mockReturnValue({});
    mockUsingRegistry.mockResolvedValue('registry-resolved');
    mockUsingInstall.mockResolvedValue('install-resolved');
    // Mirror the writer's real contract: returns the entries it actually added.
    mockWriteExcludes.mockImplementation((_root, entries) => entries);
    // The strict prompt gates on stdin (the surface enquirer reads).
    originalIsTTY = Object.getOwnPropertyDescriptor(
      process.stdin,
      'isTTY'
    )?.value;
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      configurable: true,
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    Object.defineProperty(process.stdin, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    });
  });

  it('falls back to a real install when registry resolution is opted out', async () => {
    process.env.NX_MIGRATE_USE_REGISTRY_RESOLUTION = 'false';
    const result = await resolvePackageVersionRespectingMinReleaseAge(
      'pkg-a',
      'latest'
    );
    expect(result).toBe('install-resolved');
    expect(mockReadPolicy).not.toHaveBeenCalled();
  });

  it('inactive policy uses the legacy registry resolution', async () => {
    mockReadPolicy.mockResolvedValue({ outcome: 'inactive' });
    const result = await resolvePackageVersionRespectingMinReleaseAge(
      'pkg-a',
      'latest'
    );
    expect(result).toBe('registry-resolved');
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('ambiguous policy falls back to a real install', async () => {
    mockReadPolicy.mockResolvedValue({
      outcome: 'ambiguous',
      reason: 'unknown pnpm major',
    });
    const result = await resolvePackageVersionRespectingMinReleaseAge(
      'pkg-a',
      'latest'
    );
    expect(result).toBe('install-resolved');
  });

  it('reads the policy only once per process', async () => {
    mockReadPolicy.mockResolvedValue({ outcome: 'inactive' });
    await resolvePackageVersionRespectingMinReleaseAge('pkg-a', 'latest');
    await resolvePackageVersionRespectingMinReleaseAge('pkg-b', 'latest');
    expect(mockReadPolicy).toHaveBeenCalledTimes(1);
  });

  it('active policy returns the compliant pick', async () => {
    mockReadPolicy.mockResolvedValue(pnpmPolicy());
    mockResolve.mockResolvedValue({ version: '1.2.0', unconstrained: '1.2.0' });
    const result = await resolvePackageVersionRespectingMinReleaseAge(
      'pkg-a',
      '^1.0.0'
    );
    expect(result).toBe('1.2.0');
  });

  it('logs a one-liner (deduped) when the pick differs from the unconstrained version', async () => {
    const log = jest
      .spyOn(require('../../utils/output').output, 'log')
      .mockImplementation(() => {});
    mockReadPolicy.mockResolvedValue(pnpmPolicy());
    mockResolve.mockResolvedValue({ version: '1.1.1', unconstrained: '1.2.0' });

    await resolvePackageVersionRespectingMinReleaseAge('pkg-a', '^1.0.0');
    await resolvePackageVersionRespectingMinReleaseAge('pkg-a', '^1.0.0');

    const changedLogs = log.mock.calls.filter((c) =>
      c[0].title.includes('instead of 1.2.0')
    );
    expect(changedLogs).toHaveLength(1);
    expect(changedLogs[0][0].title).toContain('Resolved pkg-a@1.1.1');
    log.mockRestore();
  });

  it('pnpm loose immature pick writes an exclude + heads-up when the PM writes excludes', async () => {
    jest
      .spyOn(require('../../utils/output').output, 'log')
      .mockImplementation(() => {});
    mockReadPolicy.mockResolvedValue(pnpmPolicy({ writesExcludes: true }));
    mockResolve.mockResolvedValue({
      version: '1.0.1',
      unconstrained: '1.0.1',
      immature: true,
    });

    const result = await resolvePackageVersionRespectingMinReleaseAge(
      'pkg-b',
      '^1.0.0'
    );
    expect(result).toBe('1.0.1');
    expect(mockWriteExcludes).toHaveBeenCalledWith(expect.any(String), [
      'pkg-b@1.0.1',
    ]);
  });

  it('pnpm loose immature pick on a version that does not write excludes installs silently', async () => {
    mockReadPolicy.mockResolvedValue(pnpmPolicy({ writesExcludes: false }));
    mockResolve.mockResolvedValue({
      version: '1.0.1',
      unconstrained: '1.0.1',
      immature: true,
    });
    const result = await resolvePackageVersionRespectingMinReleaseAge(
      'pkg-b',
      '^1.0.0'
    );
    expect(result).toBe('1.0.1');
    expect(mockWriteExcludes).not.toHaveBeenCalled();
  });

  it('does not repeat the heads-up when the exclude was already present', async () => {
    const log = jest
      .spyOn(require('../../utils/output').output, 'log')
      .mockImplementation(() => {});
    mockReadPolicy.mockResolvedValue(pnpmPolicy({ writesExcludes: true }));
    mockResolve.mockResolvedValue({
      version: '1.0.1',
      unconstrained: '1.0.1',
      immature: true,
    });
    // Writer reports nothing newly added (entry already present).
    mockWriteExcludes.mockReturnValue([]);

    await resolvePackageVersionRespectingMinReleaseAge('pkg-b', '^1.0.0');

    const addedLogs = log.mock.calls.filter((c) =>
      c[0].title.includes('Added pkg-b')
    );
    expect(addedLogs).toHaveLength(0);
    log.mockRestore();
  });

  it('rethrows a violation when the policy is not pnpm strict + writesExcludes', async () => {
    mockReadPolicy.mockResolvedValue(pnpmPolicy({ strict: false }));
    mockResolve.mockRejectedValue(
      violation([{ version: '2.0.0', publishedAt: '6h ago' }])
    );
    await expect(
      resolvePackageVersionRespectingMinReleaseAge('pkg-a', '^2.0.0')
    ).rejects.toBeInstanceOf(MinReleaseAgeViolationError);
  });

  it('side-effect-free resolution returns an immature pick without writing excludes', async () => {
    mockReadPolicy.mockResolvedValue(pnpmPolicy({ writesExcludes: true }));
    mockResolve.mockResolvedValue({
      version: '1.0.1',
      unconstrained: '1.0.1',
      immature: true,
    });

    const result = await resolvePackageVersionRespectingMinReleaseAge(
      'pkg-b',
      '^1.0.0',
      { applySideEffects: false }
    );
    expect(result).toBe('1.0.1');
    expect(mockWriteExcludes).not.toHaveBeenCalled();
  });

  it('side-effect-free resolution rethrows a strict violation without prompting', async () => {
    mockReadPolicy.mockResolvedValue(pnpmPolicy({ strict: true }));
    mockResolve.mockRejectedValue(
      violation([{ version: '2.0.0', publishedAt: '6h ago' }])
    );

    await expect(
      resolvePackageVersionRespectingMinReleaseAge('pkg-a', '^2.0.0', {
        applySideEffects: false,
      })
    ).rejects.toBeInstanceOf(MinReleaseAgeViolationError);
    expect(mockPrompt).not.toHaveBeenCalled();
    expect(mockWriteExcludes).not.toHaveBeenCalled();
  });

  it('side-effect-free resolution uses a raw registry view (not an install) when there is no active cooldown, even with registry resolution opted out', async () => {
    process.env.NX_MIGRATE_USE_REGISTRY_RESOLUTION = 'false';
    mockReadPolicy.mockResolvedValue({ outcome: 'inactive' });
    const result = await resolvePackageVersionRespectingMinReleaseAge(
      'pkg-a',
      '^2.0.0',
      { applySideEffects: false }
    );
    expect(result).toBe('registry-resolved');
    expect(mockUsingInstall).not.toHaveBeenCalled();
  });

  it('side-effect-free resolution still reproduces an active cooldown when registry resolution is opted out', async () => {
    // A probe can never install, so opting out of registry resolution (which only
    // chooses install vs. registry for the real resolution) must not bypass the
    // cooldown - otherwise the multi-major probe pre-selects a too-new version
    // the real install then rejects.
    process.env.NX_MIGRATE_USE_REGISTRY_RESOLUTION = 'false';
    mockReadPolicy.mockResolvedValue(pnpmPolicy());
    mockResolve.mockResolvedValue({ version: '1.2.0', unconstrained: '1.5.0' });

    const result = await resolvePackageVersionRespectingMinReleaseAge(
      'pkg-a',
      '^1.0.0',
      { applySideEffects: false }
    );
    expect(result).toBe('1.2.0');
    expect(mockUsingRegistry).not.toHaveBeenCalled();
    expect(mockUsingInstall).not.toHaveBeenCalled();
  });

  it('side-effect-free resolution uses a registry view (not an install) for an ambiguous policy', async () => {
    mockReadPolicy.mockResolvedValue({
      outcome: 'ambiguous',
      reason: 'unknown pnpm major',
    });
    const result = await resolvePackageVersionRespectingMinReleaseAge(
      'pkg-a',
      '^2.0.0',
      { applySideEffects: false }
    );
    expect(result).toBe('registry-resolved');
    expect(mockUsingInstall).not.toHaveBeenCalled();
  });

  it('pnpm strict violation with no blocked candidates rethrows without prompting', async () => {
    mockReadPolicy.mockResolvedValue(pnpmPolicy({ strict: true }));
    // An unknown tag produces a violation carrying no blocked versions.
    mockResolve.mockRejectedValue(violation([]));

    await expect(
      resolvePackageVersionRespectingMinReleaseAge('pkg-a', 'bogus-tag')
    ).rejects.toBeInstanceOf(MinReleaseAgeViolationError);
    expect(mockPrompt).not.toHaveBeenCalled();
    expect(mockWriteExcludes).not.toHaveBeenCalled();
  });

  it('pnpm strict violation rethrows in non-TTY/CI without prompting', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: false,
      configurable: true,
    });
    mockReadPolicy.mockResolvedValue(pnpmPolicy({ strict: true }));
    mockResolve.mockRejectedValue(
      violation([{ version: '2.0.0', publishedAt: '6h ago' }])
    );
    await expect(
      resolvePackageVersionRespectingMinReleaseAge('pkg-a', '^2.0.0')
    ).rejects.toBeInstanceOf(MinReleaseAgeViolationError);
    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it('pnpm strict violation: approve writes excludes and returns the blocked version', async () => {
    mockReadPolicy.mockResolvedValue(pnpmPolicy({ strict: true }));
    mockResolve.mockRejectedValue(
      violation([{ version: '2.0.0', publishedAt: '6h ago' }])
    );
    mockPrompt.mockResolvedValue({ approved: true });

    const result = await resolvePackageVersionRespectingMinReleaseAge(
      'pkg-a',
      '^2.0.0'
    );
    expect(result).toBe('2.0.0');
    expect(mockWriteExcludes).toHaveBeenCalledWith(expect.any(String), [
      'pkg-a@2.0.0',
    ]);
  });

  it('pnpm strict violation: approve returns and excludes the lowest in-range version only', async () => {
    mockReadPolicy.mockResolvedValue(pnpmPolicy({ strict: true }));
    // blocked is sorted newest-first; the loose resolver would pick the lowest.
    mockResolve.mockRejectedValue(
      violation([
        { version: '2.1.0', publishedAt: '4h ago' },
        { version: '2.0.0', publishedAt: '6h ago' },
      ])
    );
    mockPrompt.mockResolvedValue({ approved: true });

    const result = await resolvePackageVersionRespectingMinReleaseAge(
      'pkg-a',
      '^2.0.0'
    );
    expect(result).toBe('2.0.0');
    expect(mockWriteExcludes).toHaveBeenCalledWith(expect.any(String), [
      'pkg-a@2.0.0',
    ]);
  });

  it('pnpm strict violation: deny throws a MinReleaseAgeViolationError so the fetcher does not silently install', async () => {
    mockReadPolicy.mockResolvedValue(pnpmPolicy({ strict: true }));
    mockResolve.mockRejectedValue(
      violation([{ version: '2.0.0', publishedAt: '6h ago' }])
    );
    mockPrompt.mockResolvedValue({ approved: false });

    // The fetcher catch in migrate.ts only rethrows MinReleaseAgeViolationError;
    // a plain Error here would silently fall back to a real PM install.
    const denial = await resolvePackageVersionRespectingMinReleaseAge(
      'pkg-a',
      '^2.0.0'
    ).catch((e) => e);
    expect(denial).toBeInstanceOf(MinReleaseAgeViolationError);
    expect(denial.message).toContain('were not approved');
    expect(denial.packageName).toBe('pkg-a');
    expect(denial.blocked).toEqual([
      { version: '2.0.0', publishedAt: '6h ago' },
    ]);
    expect(denial.remediation.join('\n')).toContain('minimumReleaseAgeExclude');
    expect(denial.remediation.join('\n')).toContain('minimumReleaseAgeStrict');
    expect(mockWriteExcludes).not.toHaveBeenCalled();
  });

  it('pnpm strict violation prompts once, then auto-writes for later picks', async () => {
    mockReadPolicy.mockResolvedValue(pnpmPolicy({ strict: true }));
    mockResolve
      .mockRejectedValueOnce(
        violation([{ version: '2.0.0', publishedAt: '6h ago' }])
      )
      .mockRejectedValueOnce(
        violation([{ version: '3.0.0', publishedAt: '5h ago' }])
      );
    mockPrompt.mockResolvedValue({ approved: true });

    await resolvePackageVersionRespectingMinReleaseAge('pkg-a', '^2.0.0');
    const second = await resolvePackageVersionRespectingMinReleaseAge(
      'pkg-b',
      '^3.0.0'
    );

    expect(second).toBe('3.0.0');
    expect(mockPrompt).toHaveBeenCalledTimes(1);
    expect(mockWriteExcludes).toHaveBeenCalledTimes(2);
  });

  it('an unexpected error tries a real install before rethrowing the original', async () => {
    mockReadPolicy.mockResolvedValue(pnpmPolicy());
    const boom = new Error('registry exploded');
    mockResolve.mockRejectedValue(boom);
    mockUsingInstall.mockResolvedValue('install-fallback');

    const result = await resolvePackageVersionRespectingMinReleaseAge(
      'pkg-a',
      'latest'
    );
    expect(result).toBe('install-fallback');
  });

  it('rethrows the ORIGINAL error when the install fallback also fails', async () => {
    mockReadPolicy.mockResolvedValue(pnpmPolicy());
    const boom = new Error('registry exploded');
    mockResolve.mockRejectedValue(boom);
    mockUsingInstall.mockRejectedValue(new Error('install also failed'));

    await expect(
      resolvePackageVersionRespectingMinReleaseAge('pkg-a', 'latest')
    ).rejects.toThrow('registry exploded');
  });
});
