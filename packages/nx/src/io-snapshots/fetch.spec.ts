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
  /** A stored set for HEAD. */
  const stored = () => ({
    commit: 'head',
    resolution: {
      fetchedAt: 0,
      updatedAt: 7,
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
    store.import.mockReturnValue(stored());
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

  it('serves a stored set under an hour old without loading the client', async () => {
    const set = stored();
    store.get.mockReturnValue(set);
    const result = await fetchIoSnapshotsForRun(nxJson, {}, optedIn());
    expect(result).toEqual({ status: 'cached', snapshots: set });
    expect(store.get).toHaveBeenCalledWith('head', 60 * 60 * 1000);
    expect(cloud.verifyOrUpdateNxCloudClient).not.toHaveBeenCalled();
  });

  // Nx Cloud resolves HEAD from its nearest recorded ancestors, so a closer
  // recording can appear for the same commit: past an hour the run asks.
  it('asks Nx Cloud when no stored set is young enough', async () => {
    cloud.readIoSnapshots.mockResolvedValue({
      commits: ['head'],
      updatedAt: 9,
      snapshots: {},
    });
    store.import.mockReturnValue(stored());
    await fetchIoSnapshotsForRun(nxJson, { accessToken: 't' }, optedIn());
    expect(cloud.readIoSnapshots).toHaveBeenCalledWith(
      expect.not.objectContaining({ knownUpdatedAt: expect.anything() })
    );
    expect(cloud.readIoSnapshots).toHaveBeenCalledWith(
      expect.objectContaining({ nxCloudOptions: { accessToken: 't' } })
    );
  });

  it('skips when Nx Cloud answers with no set', async () => {
    cloud.readIoSnapshots.mockResolvedValue(null);
    expect(await fetchIoSnapshotsForRun(nxJson, {}, optedIn())).toMatchObject({
      status: 'skipped',
      reason: 'invalid-response',
    });
    expect(store.import).not.toHaveBeenCalled();
  });

  it('imports what the client read', async () => {
    cloud.readIoSnapshots.mockResolvedValue({
      commits: ['head', 'parent'],
      updatedAt: 9,
      snapshots: {
        'web:build': { commit: 'parent', inputs: ['apps/web/**'], outputs: [] },
      },
    });
    const set = stored();
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

  it('hashes natively when the read fails', async () => {
    cloud.readIoSnapshots.mockRejectedValue(
      Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })
    );
    expect(await fetchIoSnapshotsForRun(nxJson, {}, optedIn())).toEqual({
      status: 'skipped',
      reason: 'offline',
      message: 'getaddrinfo ENOTFOUND',
    });
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
