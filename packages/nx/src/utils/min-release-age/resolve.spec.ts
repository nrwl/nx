jest.mock('./packument', () => ({
  fetchRegistryMetadata: jest.fn(),
  fetchDeprecations: jest.fn(),
}));
jest.mock('./pick', () => {
  const { valid, validRange } = require('semver');
  return {
    pickMinReleaseAgeCompliantVersion: jest.fn(),
    // real classification so the deprecation-prefetch gate evaluates correctly
    classifySpec: (spec: string) =>
      valid(spec) ? 'exact' : validRange(spec) ? 'range' : 'tag',
  };
});

import { fetchDeprecations, fetchRegistryMetadata } from './packument';
import { pickMinReleaseAgeCompliantVersion } from './pick';
import type { MinReleaseAgePolicy } from './policy';
import { resolveCompliantVersion } from './resolve';

const mockFetchMetadata = fetchRegistryMetadata as jest.Mock;
const mockFetchDeprecations = fetchDeprecations as jest.Mock;
const mockPick = pickMinReleaseAgeCompliantVersion as jest.Mock;

function pnpmPolicy(
  latestTagDegrade: 'same-major' | 'any-major'
): MinReleaseAgePolicy {
  return {
    packageManager: 'pnpm',
    packageManagerVersion: '11.5.2',
    cutoffMs: 0,
    windowMs: 0,
    sourceDescription: 'pnpm',
    isExcluded: () => false,
    behavior: {
      packageManager: 'pnpm',
      strict: false,
      looseFallback: true,
      latestTagDegrade,
      writesExcludes: true,
      missingTimeMap: 'skip',
    },
  };
}

function npmPolicy(): MinReleaseAgePolicy {
  return {
    packageManager: 'npm',
    packageManagerVersion: '11.16.0',
    cutoffMs: 0,
    windowMs: 0,
    sourceDescription: 'npm',
    isExcluded: () => false,
    behavior: { packageManager: 'npm' },
  };
}

describe('resolveCompliantVersion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchMetadata.mockResolvedValue({
      name: 'pkg-a',
      versions: [],
      time: {},
      distTags: {},
    });
    mockPick.mockReturnValue({ version: '1.2.0', unconstrained: '1.2.0' });
  });

  it('fetches the packument and returns the pick', async () => {
    const outcome = await resolveCompliantVersion(
      'pkg-a',
      '^1.0.0',
      pnpmPolicy('any-major')
    );
    expect(mockFetchMetadata).toHaveBeenCalledWith('pkg-a');
    expect(outcome).toEqual({ version: '1.2.0', unconstrained: '1.2.0' });
  });

  it('prefetches and attaches deprecations for a pnpm any-major tag degrade', async () => {
    mockFetchDeprecations.mockResolvedValue({ '2.0.0': 'old' });

    await resolveCompliantVersion('pkg-a', 'latest', pnpmPolicy('any-major'));

    expect(mockFetchDeprecations).toHaveBeenCalledWith('pkg-a');
    // The map is attached to the metadata the pick consumes.
    expect(mockPick.mock.calls[0][1].deprecations).toEqual({ '2.0.0': 'old' });
  });

  it('does not prefetch deprecations for a non-tag spec', async () => {
    await resolveCompliantVersion('pkg-a', '^1.0.0', pnpmPolicy('any-major'));
    expect(mockFetchDeprecations).not.toHaveBeenCalled();
  });

  it('does not prefetch deprecations for a same-major degrade', async () => {
    await resolveCompliantVersion('pkg-a', 'latest', pnpmPolicy('same-major'));
    expect(mockFetchDeprecations).not.toHaveBeenCalled();
  });

  it('does not prefetch deprecations for a non-pnpm policy', async () => {
    await resolveCompliantVersion('pkg-a', 'latest', npmPolicy());
    expect(mockFetchDeprecations).not.toHaveBeenCalled();
  });
});
