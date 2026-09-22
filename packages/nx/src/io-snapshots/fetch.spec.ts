import { fetchIoSnapshotsForRun } from './fetch';

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
vi.mock('../utils/db-connection', () => ({ getDbConnection: () => 'db' }));
vi.mock('../utils/nx-cloud-utils', () => ({
  isNxCloudUsed: () => true,
  isNxCloudDisabled: () => false,
}));
vi.mock('../utils/output', () => ({ output: { warn: vi.fn() } }));
vi.mock('../utils/logger', () => ({ logger: { verbose: vi.fn() } }));

describe('fetchIoSnapshotsForRun', () => {
  const nxJson = {} as any;
  /** A run that opted in, stated explicitly so the machine's env cannot. */
  const ci = (overrides: Record<string, unknown> = {}) => ({
    NX_IO_SNAPSHOTS: 'true',
    ...overrides,
  });
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
    cloud.verifyOrUpdateNxCloudClient.mockResolvedValue({
      nxCloudClient: {
        configureLightClientRequire: () => () => {},
        readIoSnapshots: cloud.readIoSnapshots,
      },
    });
    native.loadIoSnapshots.mockReturnValue(loaded());
    native.readIoSnapshotResolution.mockReturnValue(null);
  });

  // Connecting the workspace is not the opt-in: a run that says nothing
  // never reaches the client.
  it('does nothing for a run that did not opt in', async () => {
    expect(
      await fetchIoSnapshotsForRun(
        nxJson,
        {},
        ci({ NX_IO_SNAPSHOTS: undefined })
      )
    ).toBeNull();
    expect(cloud.verifyOrUpdateNxCloudClient).not.toHaveBeenCalled();
  });

  it('is forced on outside CI by the debug override', async () => {
    cloud.readIoSnapshots.mockResolvedValue({
      commits: ['head'],
      updatedAt: 9,
      snapshots: {},
    });
    native.importIoSnapshots.mockReturnValue(loaded());
    expect(
      await fetchIoSnapshotsForRun(
        nxJson,
        {},
        ci({ ci: false, NX_IO_SNAPSHOTS: 'true' })
      )
    ).toMatchObject({ status: 'cached' });
  });

  it('is off when the opt-in is set to anything but true', async () => {
    expect(
      await fetchIoSnapshotsForRun(nxJson, {}, ci({ NX_IO_SNAPSHOTS: 'false' }))
    ).toBeNull();
    expect(cloud.verifyOrUpdateNxCloudClient).not.toHaveBeenCalled();
  });

  it('serves a fresh cached bundle without loading the client', async () => {
    native.readIoSnapshotResolution.mockReturnValue(cached(Date.now()));
    const result = await fetchIoSnapshotsForRun(nxJson, {}, ci());
    expect(result.status).toBe('cached');
    expect(native.loadIoSnapshots).toHaveBeenCalledWith('db', 'head');
    expect(cloud.verifyOrUpdateNxCloudClient).not.toHaveBeenCalled();
  });

  // Nx Cloud resolves HEAD from its nearest recorded ancestors, so a closer
  // recording can appear for the same commit: past an hour the run asks.
  it('asks again once a stored set is older than an hour', async () => {
    cloud.readIoSnapshots.mockResolvedValue(null);
    native.readIoSnapshotResolution.mockReturnValue(
      cached(Date.now() - 59 * 60 * 1000)
    );
    await fetchIoSnapshotsForRun(nxJson, {}, ci());
    expect(cloud.readIoSnapshots).not.toHaveBeenCalled();

    native.readIoSnapshotResolution.mockReturnValue(
      cached(Date.now() - 61 * 60 * 1000)
    );
    await fetchIoSnapshotsForRun(nxJson, {}, ci());
    expect(cloud.readIoSnapshots).toHaveBeenCalledTimes(1);
  });

  it('asks the client with knownUpdatedAt and keeps the cache when unchanged', async () => {
    native.readIoSnapshotResolution.mockReturnValue(cached(0, 7));
    cloud.readIoSnapshots.mockResolvedValue(null);
    const result = await fetchIoSnapshotsForRun(
      nxJson,
      { accessToken: 't' },
      ci()
    );
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
    const result = await fetchIoSnapshotsForRun(nxJson, {}, ci());
    expect(native.importIoSnapshots).toHaveBeenCalledWith(
      'db',
      expect.objectContaining({
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

  it('hashes natively when the read fails, stored set or not', async () => {
    const offline = Object.assign(new Error('getaddrinfo ENOTFOUND'), {
      code: 'ENOTFOUND',
    });
    cloud.readIoSnapshots.mockRejectedValue(offline);

    // A stored set for this commit is NOT reused when the fetch fails: the
    // run hashes natively rather than from a recording it could not refresh.
    native.readIoSnapshotResolution.mockReturnValue(cached(0));
    expect(await fetchIoSnapshotsForRun(nxJson, {}, ci())).toMatchObject({
      status: 'skipped',
      reason: 'offline',
    });
    expect(native.loadIoSnapshots).not.toHaveBeenCalled();

    native.readIoSnapshotResolution.mockReturnValue(null);
    const skipped = await fetchIoSnapshotsForRun(nxJson, {}, ci());
    expect(skipped).toMatchObject({ status: 'skipped', reason: 'offline' });
  });

  it('maps the client error codes to reasons', async () => {
    cloud.readIoSnapshots.mockRejectedValue(
      Object.assign(new Error('bad'), { code: 'INVALID_RESPONSE' })
    );
    expect(await fetchIoSnapshotsForRun(nxJson, {}, ci())).toMatchObject({
      status: 'skipped',
      reason: 'invalid-response',
    });
  });

  it('reports a client that predates snapshots', async () => {
    cloud.verifyOrUpdateNxCloudClient.mockResolvedValue({
      nxCloudClient: { configureLightClientRequire: () => () => {} },
    });
    expect(await fetchIoSnapshotsForRun(nxJson, {}, ci())).toMatchObject({
      status: 'skipped',
      reason: 'unsupported-client',
    });
  });
});
