import type { Mock } from 'vitest';
import type { NxJsonConfiguration } from '../config/nx-json';

vi.mock('../native', () => ({ fetchIoSnapshots: vi.fn() }));
// The real module resolves the token once at import; mirror its precedence
// lazily so the env rows below can vary it.
vi.mock('../nx-cloud/utilities/environment', () => ({
  get ACCESS_TOKEN() {
    return process.env.NX_CLOUD_AUTH_TOKEN || process.env.NX_CLOUD_ACCESS_TOKEN;
  },
}));
vi.mock('../utils/output', () => ({
  output: { warn: vi.fn() },
}));
vi.mock('../utils/logger', () => ({
  logger: { verbose: vi.fn() },
}));

import { fetchIoSnapshots } from '../native';
import { output } from '../utils/output';
import { logger } from '../utils/logger';
import {
  fetchIoSnapshotsForRun,
  ioSnapshotApiUrl,
  ioSnapshotsCacheDirectory,
  isIoSnapshotFetchEnabled,
} from './fetch';

const fetchMock = fetchIoSnapshots as Mock;
const ENV_KEYS = [
  'NX_IO_SNAPSHOTS',
  'NX_NO_CLOUD',
  'NX_CLOUD_API',
  'NRWL_API',
  'NX_CLOUD_AUTH_TOKEN',
  'NX_CLOUD_ACCESS_TOKEN',
  'NX_IO_SNAPSHOTS_MAX_AGE',
];

describe('fetchIoSnapshotsForRun', () => {
  const env: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.clearAllMocks();
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

    // The debug override never beats a disabled Cloud.
    process.env.NX_NO_CLOUD = 'true';
    expect(isIoSnapshotFetchEnabled(enabled)).toBe(false);
    delete process.env.NX_NO_CLOUD;
    expect(isIoSnapshotFetchEnabled(enabled, { cloud: false })).toBe(false);
    expect(
      isIoSnapshotFetchEnabled({ ...enabled, neverConnectToCloud: true })
    ).toBe(false);
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
      url: 'https://cloud.example.com/',
    });

    expect(result.status).toBe('fetched');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cacheDirectory: ioSnapshotsCacheDirectory,
        apiUrl: 'https://cloud.example.com',
        accessToken: 'env-token',
        nxCloudId: 'id',
        maxAgeMs: 0,
        failureMaxAgeMs: 0,
      })
    );
    process.env.NRWL_API = 'https://enterprise.example.com/';
    expect(ioSnapshotApiUrl({ url: 'https://cloud.example.com' })).toBe(
      'https://enterprise.example.com'
    );

    process.env.NX_CLOUD_AUTH_TOKEN = 'auth-token';
    await fetchIoSnapshotsForRun(enabled, { accessToken: 'json-token' });
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ accessToken: 'auth-token' })
    );
    expect(logger.verbose).toHaveBeenCalledWith(
      expect.stringContaining('3 tasks')
    );
    expect(output.warn).not.toHaveBeenCalled();
  });

  it('warns only for misconfiguration, not for being offline or an old Cloud', async () => {
    fetchMock.mockResolvedValueOnce({
      status: 'skipped',
      reason: 'offline',
      message: 'connect refused',
    });
    await fetchIoSnapshotsForRun(enabled, { nxCloudId: 'id' });
    fetchMock.mockResolvedValueOnce({
      status: 'skipped',
      reason: 'unsupported-server',
      message: '404',
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
