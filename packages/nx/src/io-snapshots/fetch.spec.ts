import { fetchIoSnapshotsForRun } from './fetch';

const store = vi.hoisted(() => ({
  import: vi.fn(),
  get: vi.fn(),
}));
const cloud = vi.hoisted(() => ({
  verifyOrUpdateNxCloudClient: vi.fn(),
  readIoSnapshots: vi.fn(),
}));

vi.mock('../native', () => ({
  IoSnapshotStore: vi.fn(function () {
    return store;
  }),
}));
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
  const optedIn = (overrides: Record<string, unknown> = {}) => ({
    NX_IO_SNAPSHOTS: 'true',
    ...overrides,
  });
  /** A stored set for HEAD, fetched at `fetchedAt`. */
  const stored = (fetchedAt: number, updatedAt = 7) => ({
    commit: 'head',
    resolution: {
      fetchedAt,
      updatedAt,
      requestedCommit: 'head',
      tasks: 1,
      sourceCommits: [],
      digest: 'd',
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    store.get.mockReset();
    store.import.mockReset();
    delete process.env.NX_IO_SNAPSHOTS;
    cloud.verifyOrUpdateNxCloudClient.mockResolvedValue({
      nxCloudClient: {
        configureLightClientRequire: () => () => {},
        readIoSnapshots: cloud.readIoSnapshots,
      },
    });
    store.get.mockReturnValue(null);
  });

  // Connecting the workspace is not the opt-in: a run that says nothing
  // never reaches the client.
  it('does nothing for a run that did not opt in', async () => {
    expect(
      await fetchIoSnapshotsForRun(
        nxJson,
        {},
        optedIn({ NX_IO_SNAPSHOTS: undefined })
      )
    ).toBeNull();
    expect(cloud.verifyOrUpdateNxCloudClient).not.toHaveBeenCalled();
  });

  it('is on when the opt-in is true', async () => {
    cloud.readIoSnapshots.mockResolvedValue({
      commits: ['head'],
      updatedAt: 9,
      snapshots: {},
    });
    store.import.mockReturnValue(stored(Date.now()));
    expect(await fetchIoSnapshotsForRun(nxJson, {}, optedIn())).toMatchObject({
      status: 'fetched',
    });
  });

  it('is off when the opt-in is set to anything but true', async () => {
    expect(
      await fetchIoSnapshotsForRun(
        nxJson,
        {},
        optedIn({ NX_IO_SNAPSHOTS: 'false' })
      )
    ).toBeNull();
    expect(cloud.verifyOrUpdateNxCloudClient).not.toHaveBeenCalled();
  });

  it('serves a fresh stored set without loading the client', async () => {
    const set = stored(Date.now());
    store.get.mockReturnValue(set);
    const result = await fetchIoSnapshotsForRun(nxJson, {}, optedIn());
    expect(result).toEqual({ status: 'cached', snapshots: set });
    expect(store.get).toHaveBeenCalledWith('head');
    expect(cloud.verifyOrUpdateNxCloudClient).not.toHaveBeenCalled();
  });

  // Nx Cloud resolves HEAD from its nearest recorded ancestors, so a closer
  // recording can appear for the same commit: past an hour the run asks.
  it('asks again once a stored set is older than an hour', async () => {
    cloud.readIoSnapshots.mockResolvedValue(null);
    store.get.mockReturnValue(stored(Date.now() - 59 * 60 * 1000));
    await fetchIoSnapshotsForRun(nxJson, {}, optedIn());
    expect(cloud.readIoSnapshots).not.toHaveBeenCalled();

    store.get.mockReturnValue(stored(Date.now() - 61 * 60 * 1000));
    await fetchIoSnapshotsForRun(nxJson, {}, optedIn());
    expect(cloud.readIoSnapshots).toHaveBeenCalledTimes(1);
  });

  it('asks the client with knownUpdatedAt and keeps the stored set when unchanged', async () => {
    const set = stored(0, 7);
    store.get.mockReturnValue(set);
    cloud.readIoSnapshots.mockResolvedValue(null);
    const result = await fetchIoSnapshotsForRun(
      nxJson,
      { accessToken: 't' },
      optedIn()
    );
    expect(cloud.readIoSnapshots).toHaveBeenCalledWith(
      expect.objectContaining({
        knownUpdatedAt: 7,
        nxCloudOptions: { accessToken: 't' },
      })
    );
    expect(store.import).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'cached', snapshots: set });
  });

  it('imports what the client read', async () => {
    cloud.readIoSnapshots.mockResolvedValue({
      commits: ['head', 'parent'],
      updatedAt: 9,
      snapshots: {
        'web:build': { commit: 'parent', inputs: ['apps/web/**'], outputs: [] },
      },
    });
    const set = stored(Date.now());
    store.import.mockReturnValue(set);
    const result = await fetchIoSnapshotsForRun(nxJson, {}, optedIn());
    expect(store.import).toHaveBeenCalledWith(
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
    expect(result).toEqual({ status: 'fetched', snapshots: set });
  });

  it('hashes natively when the read fails, stored set or not', async () => {
    const offline = Object.assign(new Error('getaddrinfo ENOTFOUND'), {
      code: 'ENOTFOUND',
    });
    cloud.readIoSnapshots.mockRejectedValue(offline);

    // A stored set for this commit is NOT reused when the fetch fails: the
    // run hashes natively rather than from a recording it could not refresh.
    store.get.mockReturnValue(stored(0));
    expect(await fetchIoSnapshotsForRun(nxJson, {}, optedIn())).toEqual({
      status: 'skipped',
      reason: 'offline',
      message: 'getaddrinfo ENOTFOUND',
    });

    store.get.mockReturnValue(null);
    const skipped = await fetchIoSnapshotsForRun(nxJson, {}, optedIn());
    expect(skipped).toMatchObject({ status: 'skipped', reason: 'offline' });
  });

  it('maps client and store error codes to reasons', async () => {
    cloud.readIoSnapshots.mockRejectedValue(
      Object.assign(new Error('bad'), { code: 'UNAUTHORIZED' })
    );
    expect(await fetchIoSnapshotsForRun(nxJson, {}, optedIn())).toMatchObject({
      status: 'skipped',
      reason: 'unauthorized',
    });

    cloud.readIoSnapshots.mockResolvedValue({
      commits: ['head'],
      updatedAt: 9,
      snapshots: {},
    });
    store.import.mockImplementation(() => {
      throw Object.assign(new Error('disk full'), { code: 'WRITE_FAILED' });
    });
    expect(await fetchIoSnapshotsForRun(nxJson, {}, optedIn())).toMatchObject({
      status: 'skipped',
      reason: 'write-failed',
    });
  });

  it('reports a client that predates snapshots', async () => {
    cloud.verifyOrUpdateNxCloudClient.mockResolvedValue({
      nxCloudClient: { configureLightClientRequire: () => () => {} },
    });
    expect(await fetchIoSnapshotsForRun(nxJson, {}, optedIn())).toMatchObject({
      status: 'skipped',
      reason: 'unsupported-client',
    });
  });

  it('reports a client that could not be loaded', async () => {
    cloud.verifyOrUpdateNxCloudClient.mockResolvedValue(null);
    expect(await fetchIoSnapshotsForRun(nxJson, {}, optedIn())).toMatchObject({
      status: 'skipped',
      reason: 'no-cloud-client',
    });
  });
});
