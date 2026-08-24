import type { NxJsonConfiguration } from '../config/nx-json';

jest.mock('../native', () => ({ fetchIoSnapshots: jest.fn() }));
jest.mock('../utils/output', () => ({
  output: { warn: jest.fn() },
}));
jest.mock('../utils/logger', () => ({
  logger: { verbose: jest.fn() },
}));

import { fetchIoSnapshots } from '../native';
import { output } from '../utils/output';
import { logger } from '../utils/logger';
import {
  fetchIoSnapshotsForRun,
  ioSnapshotsCacheDirectory,
  isIoSnapshotFetchEnabled,
} from './fetch';

const fetchMock = fetchIoSnapshots as jest.Mock;
const ENV_KEYS = [
  'NX_IO_SNAPSHOTS',
  'NX_NO_CLOUD',
  'NX_CLOUD_API',
  'NX_CLOUD_ACCESS_TOKEN',
  'NX_IO_SNAPSHOTS_MAX_AGE',
];

describe('fetchIoSnapshotsForRun', () => {
  const env: Record<string, string | undefined> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of ENV_KEYS) {
      env[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (env[key] === undefined) delete process.env[key];
      else process.env[key] = env[key];
    }
  });

  const enabled: NxJsonConfiguration = { nxCloudId: 'abc' };

  it('never calls the native fetch when Nx Cloud is not used', async () => {
    expect(await fetchIoSnapshotsForRun({}, {})).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('honours the kill switch and cloud disabling', () => {
    process.env.NX_IO_SNAPSHOTS = 'false';
    expect(isIoSnapshotFetchEnabled(enabled)).toBe(false);
    delete process.env.NX_IO_SNAPSHOTS;

    process.env.NX_NO_CLOUD = 'true';
    expect(isIoSnapshotFetchEnabled(enabled)).toBe(false);
    delete process.env.NX_NO_CLOUD;

    expect(isIoSnapshotFetchEnabled(enabled, { cloud: false })).toBe(false);
    expect(
      isIoSnapshotFetchEnabled({ ...enabled, neverConnectToCloud: true })
    ).toBe(false);
    expect(isIoSnapshotFetchEnabled(enabled)).toBe(true);

    process.env.NX_IO_SNAPSHOTS = 'true';
    expect(isIoSnapshotFetchEnabled({})).toBe(true);
  });

  it('passes credentials and cache location to the native fetch', async () => {
    process.env.NX_CLOUD_ACCESS_TOKEN = 'env-token';
    process.env.NX_IO_SNAPSHOTS_MAX_AGE = '0';
    fetchMock.mockResolvedValue({
      status: 'fetched',
      resolution: {
        requestedCommit: 'a'.repeat(40),
        sourceCommits: ['b'],
        digest: 'd',
        tasks: 3,
      },
    });

    const result = await fetchIoSnapshotsForRun(enabled, {
      accessToken: 'json-token',
      nxCloudId: 'id',
      url: 'https://cloud.example.com',
    });

    expect(result.status).toBe('fetched');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cacheDirectory: ioSnapshotsCacheDirectory,
        apiUrl: 'https://cloud.example.com',
        accessToken: 'env-token',
        nxCloudId: 'id',
        maxAgeMs: 0,
      })
    );
    expect(logger.verbose).toHaveBeenCalledWith(
      expect.stringContaining('3 tasks')
    );
    expect(output.warn).not.toHaveBeenCalled();
  });

  it('warns only for misconfiguration, not for being offline', async () => {
    fetchMock.mockResolvedValueOnce({
      status: 'skipped',
      reason: 'offline',
      message: 'connect refused',
    });
    await fetchIoSnapshotsForRun(enabled, { nxCloudId: 'id' });
    expect(output.warn).not.toHaveBeenCalled();
    expect(logger.verbose).toHaveBeenCalledWith(
      expect.stringContaining('offline')
    );

    fetchMock.mockResolvedValueOnce({
      status: 'skipped',
      reason: 'unauthorized',
      message: 'bad token',
    });
    await fetchIoSnapshotsForRun(enabled, { nxCloudId: 'id' });
    expect(output.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('unauthorized'),
      })
    );
  });
});
