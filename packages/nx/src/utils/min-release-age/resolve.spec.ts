jest.mock('./packument', () => ({
  fetchRegistryMetadata: jest.fn(),
}));
jest.mock('./pick', () => ({
  pickMinReleaseAgeCompliantVersion: jest.fn(),
}));

import { fetchRegistryMetadata } from './packument';
import { pickMinReleaseAgeCompliantVersion } from './pick';
import type { MinReleaseAgePolicy } from './policy';
import { resolveCompliantVersion } from './resolve';

const mockFetchMetadata = fetchRegistryMetadata as jest.Mock;
const mockPick = pickMinReleaseAgeCompliantVersion as jest.Mock;

function pnpmPolicy(): MinReleaseAgePolicy {
  return {
    packageManagerVersion: '11.5.2',
    cutoffMs: 0,
    windowMs: 0,
    sourceDescription: 'pnpm',
    isExcluded: () => false,
    behavior: {
      packageManager: 'pnpm',
      strict: false,
      looseFallback: true,
      writesExcludes: true,
      missingTimeMap: 'skip',
    },
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
    const metadata = {
      name: 'pkg-a',
      versions: ['1.2.0'],
      time: {},
      distTags: { latest: '1.2.0' },
    };
    mockFetchMetadata.mockResolvedValue(metadata);
    const policy = pnpmPolicy();

    const outcome = await resolveCompliantVersion('pkg-a', 'latest', policy);

    expect(mockFetchMetadata).toHaveBeenCalledWith('pkg-a');
    expect(mockPick).toHaveBeenCalledWith('latest', metadata, policy);
    expect(outcome).toEqual({ version: '1.2.0', unconstrained: '1.2.0' });
  });
});
