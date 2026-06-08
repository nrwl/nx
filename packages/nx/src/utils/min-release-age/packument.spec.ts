jest.mock('../package-manager', () => ({
  packageRegistryView: jest.fn(),
}));

import { packageRegistryView } from '../package-manager';
import { fetchDeprecations, fetchRegistryMetadata } from './packument';

const viewMock = packageRegistryView as jest.Mock;

describe('fetchRegistryMetadata', () => {
  afterEach(() => jest.clearAllMocks());

  it('normalizes a scalar versions field into an array', async () => {
    viewMock.mockResolvedValue(
      JSON.stringify({
        name: 'pkg-a',
        versions: '1.0.0',
        time: { '1.0.0': '2026-01-01T00:00:00.000Z' },
        'dist-tags': { latest: '1.0.0' },
      })
    );
    const meta = await fetchRegistryMetadata('pkg-a');
    expect(meta.versions).toEqual(['1.0.0']);
    expect(meta.distTags).toEqual({ latest: '1.0.0' });
  });

  it('keeps an array versions field', async () => {
    viewMock.mockResolvedValue(
      JSON.stringify({
        name: 'pkg-a',
        versions: ['1.0.0', '1.1.0'],
        'dist-tags': { latest: '1.1.0' },
      })
    );
    const meta = await fetchRegistryMetadata('pkg-a');
    expect(meta.versions).toEqual(['1.0.0', '1.1.0']);
  });

  it('exposes a missing time map as null', async () => {
    viewMock.mockResolvedValue(
      JSON.stringify({
        name: 'pkg-a',
        versions: ['1.0.0'],
        'dist-tags': { latest: '1.0.0' },
      })
    );
    const meta = await fetchRegistryMetadata('pkg-a');
    expect(meta.time).toBeNull();
  });

  it('strips the created/modified time keys', async () => {
    viewMock.mockResolvedValue(
      JSON.stringify({
        name: 'pkg-a',
        versions: ['1.0.0'],
        time: {
          created: '2025-01-01T00:00:00.000Z',
          modified: '2026-01-01T00:00:00.000Z',
          '1.0.0': '2025-06-01T00:00:00.000Z',
        },
        'dist-tags': { latest: '1.0.0' },
      })
    );
    const meta = await fetchRegistryMetadata('pkg-a');
    expect(meta.time).toEqual({ '1.0.0': '2025-06-01T00:00:00.000Z' });
  });

  it('fetches the full packument via the empty-version registry view', async () => {
    viewMock.mockResolvedValue(
      JSON.stringify({ name: 'pkg-a', versions: ['1.0.0'] })
    );
    await fetchRegistryMetadata('pkg-a');
    expect(viewMock).toHaveBeenCalledWith('pkg-a', '', '--json');
  });
});

describe('fetchDeprecations', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns the deprecation map', async () => {
    viewMock.mockResolvedValue(
      JSON.stringify({ '1.0.0': 'deprecated', '1.1.0': true })
    );
    await expect(fetchDeprecations('pkg-a')).resolves.toEqual({
      '1.0.0': 'deprecated',
      '1.1.0': true,
    });
  });

  it('returns an empty object for a scalar/empty response', async () => {
    viewMock.mockResolvedValue('');
    await expect(fetchDeprecations('pkg-a')).resolves.toEqual({});
  });
});
