import { fetchIoSnapshotsForRun, ioSnapshotsCacheDirectory } from './fetch';

const native = vi.hoisted(() => ({
  importIoSnapshots: vi.fn(),
  loadIoSnapshots: vi.fn(),
  readIoSnapshotResolution: vi.fn(),
  skippedIoSnapshots: vi.fn((reason: string, message: string) => ({
    status: 'skipped',
    reason,
    message,
  })),
}));
const cloud = vi.hoisted(() => ({
  verifyOrUpdateNxCloudClient: vi.fn(),
  readIoSnapshots: vi.fn(),
}));

vi.mock('../native', () => native);
vi.mock('../nx-cloud/update-manager', () => ({
  verifyOrUpdateNxCloudClient: cloud.verifyOrUpdateNxCloudClient,
}));
vi.mock('../nx-cloud/resolution-helpers', () => ({
  findAncestorNodeModules: () => [],
}));
vi.mock('../utils/git-utils', () => ({ getLatestCommitSha: () => 'head' }));
vi.mock('../utils/nx-cloud-utils', () => ({
  isNxCloudUsed: () => true,
  isNxCloudDisabled: () => false,
}));
vi.mock('../utils/output', () => ({ output: { warn: vi.fn() } }));
vi.mock('../utils/logger', () => ({ logger: { verbose: vi.fn() } }));

describe('fetchIoSnapshotsForRun', () => {
  const nxJson = {} as any;
  const bundleDir = `${ioSnapshotsCacheDirectory}/head`;
  const cached = (fetchedAt: number, updatedAt = 7) => ({
    fetchedAt,
    updatedAt,
    requestedCommit: 'head',
  });
  const loaded = (reason?: string) => ({
    status: 'cached',
    reason: reason ?? null,
    resolution: {
      tasks: 1,
      requestedCommit: 'head',
      sourceCommits: [],
      digest: 'd',
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NX_IO_SNAPSHOTS;
    delete process.env.NX_IO_SNAPSHOTS_MAX_AGE;
    cloud.verifyOrUpdateNxCloudClient.mockResolvedValue({
      nxCloudClient: {
        configureLightClientRequire: () => () => {},
        readIoSnapshots: cloud.readIoSnapshots,
      },
    });
    native.loadIoSnapshots.mockReturnValue(loaded());
    native.readIoSnapshotResolution.mockReturnValue(null);
  });

  it('is off when the kill switch is set', async () => {
    process.env.NX_IO_SNAPSHOTS = 'false';
    expect(await fetchIoSnapshotsForRun(nxJson, {})).toBeNull();
    expect(cloud.verifyOrUpdateNxCloudClient).not.toHaveBeenCalled();
  });

  it('serves a fresh cached bundle without loading the client', async () => {
    native.readIoSnapshotResolution.mockReturnValue(cached(Date.now()));
    const result = await fetchIoSnapshotsForRun(nxJson, {});
    expect(result.status).toBe('cached');
    expect(native.loadIoSnapshots).toHaveBeenCalledWith(bundleDir);
    expect(cloud.verifyOrUpdateNxCloudClient).not.toHaveBeenCalled();
  });

  it('asks the client with knownUpdatedAt and keeps the cache when unchanged', async () => {
    native.readIoSnapshotResolution.mockReturnValue(cached(0, 7));
    cloud.readIoSnapshots.mockResolvedValue(null);
    const result = await fetchIoSnapshotsForRun(nxJson, { accessToken: 't' });
    expect(cloud.readIoSnapshots).toHaveBeenCalledWith(
      expect.objectContaining({
        knownUpdatedAt: 7,
        nxCloudOptions: { accessToken: 't' },
      })
    );
    expect(native.importIoSnapshots).not.toHaveBeenCalled();
    expect(result.status).toBe('cached');
  });

  it('imports what the client read', async () => {
    cloud.readIoSnapshots.mockResolvedValue({
      commits: ['head', 'parent'],
      updatedAt: 9,
      snapshots: {
        'web:build': { commit: 'parent', inputs: ['apps/web/**'], outputs: [] },
      },
    });
    native.importIoSnapshots.mockReturnValue({
      status: 'fetched',
      reason: null,
      resolution: loaded().resolution,
    });
    const result = await fetchIoSnapshotsForRun(nxJson, {});
    expect(native.importIoSnapshots).toHaveBeenCalledWith(
      expect.objectContaining({
        cacheDirectory: ioSnapshotsCacheDirectory,
        requestedCommit: 'head',
        commits: ['head', 'parent'],
        updatedAt: 9,
        snapshotsJson: JSON.stringify({
          'web:build': {
            commit: 'parent',
            inputs: ['apps/web/**'],
            outputs: [],
          },
        }),
      })
    );
    expect(result.status).toBe('fetched');
  });

  it('reuses a stale bundle when the read fails, and reports the failure otherwise', async () => {
    const offline = Object.assign(new Error('getaddrinfo ENOTFOUND'), {
      code: 'ENOTFOUND',
    });
    cloud.readIoSnapshots.mockRejectedValue(offline);

    native.readIoSnapshotResolution.mockReturnValue(cached(0));
    native.loadIoSnapshots.mockReturnValue(loaded('stale-offline'));
    const stale = await fetchIoSnapshotsForRun(nxJson, {});
    expect(native.loadIoSnapshots).toHaveBeenCalledWith(
      bundleDir,
      'stale-offline',
      'getaddrinfo ENOTFOUND'
    );
    expect(stale.reason).toBe('stale-offline');

    native.readIoSnapshotResolution.mockReturnValue(null);
    const skipped = await fetchIoSnapshotsForRun(nxJson, {});
    expect(skipped).toMatchObject({ status: 'skipped', reason: 'offline' });
  });

  it('maps the client error codes to reasons', async () => {
    cloud.readIoSnapshots.mockRejectedValue(
      Object.assign(new Error('bad'), { code: 'INVALID_RESPONSE' })
    );
    expect(await fetchIoSnapshotsForRun(nxJson, {})).toMatchObject({
      status: 'skipped',
      reason: 'invalid-response',
    });
  });

  it('reports a client that predates snapshots', async () => {
    cloud.verifyOrUpdateNxCloudClient.mockResolvedValue({
      nxCloudClient: { configureLightClientRequire: () => () => {} },
    });
    expect(await fetchIoSnapshotsForRun(nxJson, {})).toMatchObject({
      status: 'skipped',
      reason: 'unsupported-client',
    });
  });
});
