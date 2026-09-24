import {
  importIoSnapshots,
  loadIoSnapshotsForRun,
  openIoSnapshots,
} from './store';

const store = vi.hoisted(() => ({
  import: vi.fn(),
  get: vi.fn(),
  getVersion: vi.fn(),
}));
const cloud = vi.hoisted(() => ({ fetchIoSnapshots: vi.fn() }));

const IoSnapshotStore = vi.hoisted(() =>
  vi.fn(function () {
    return store;
  })
);
vi.mock('../native', () => ({ IoSnapshotStore }));
vi.mock('./fetch', () => ({ fetchIoSnapshots: cloud.fetchIoSnapshots }));
vi.mock('../utils/git-utils', () => ({ getLatestCommitSha: () => 'head' }));
vi.mock('../utils/db-connection', () => ({ getDbConnection: () => 'db' }));
vi.mock('../utils/nx-cloud-utils', () => ({
  isNxCloudConfigured: () => true,
}));
const warn = vi.hoisted(() => vi.fn());
vi.mock('../utils/output', () => ({ output: { warn } }));
vi.mock('../utils/logger', () => ({ logger: { verbose: vi.fn() } }));

describe('loadIoSnapshotsForRun', () => {
  afterEach(() => vi.unstubAllEnvs());

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
      requestedCommit: 'head',
      tasks: 1,
    },
  });
  const coded = (code: string, message = code) =>
    Object.assign(new Error(message), { code });

  beforeEach(() => {
    vi.stubEnv('CI', 'true');
    vi.clearAllMocks();
    store.get.mockReset();
    store.import.mockReset();
    store.get.mockReturnValue(null);
    cloud.fetchIoSnapshots.mockResolvedValue({
      snapshots: {},
    });
  });

  // Connecting the workspace is not the opt-in: a run that says nothing
  // never reaches Nx Cloud.
  it('does nothing for a run that did not opt in', async () => {
    for (const NX_IO_SNAPSHOTS of [undefined, 'false']) {
      expect(
        await loadIoSnapshotsForRun(nxJson, {}, optedIn({ NX_IO_SNAPSHOTS }))
      ).toBeNull();
    }
    expect(cloud.fetchIoSnapshots).not.toHaveBeenCalled();
  });

  it('serves a stored set under an hour old without asking Nx Cloud', async () => {
    const set = stored();
    store.get.mockReturnValue(set);
    expect(await loadIoSnapshotsForRun(nxJson, {}, optedIn())).toEqual({
      status: 'cached',
      snapshots: set,
    });
    expect(store.get).toHaveBeenCalledWith('head', 60 * 60 * 1000);
    expect(cloud.fetchIoSnapshots).not.toHaveBeenCalled();
  });

  it('imports what Nx Cloud read when no stored set is young enough', async () => {
    const snapshots = {
      'web:build': { commit: 'parent', inputs: ['apps/web/**'], outputs: [] },
    };
    cloud.fetchIoSnapshots.mockResolvedValue({
      snapshots,
    });
    const set = stored();
    store.import.mockReturnValue(set);
    const result = await loadIoSnapshotsForRun(
      nxJson,
      { accessToken: 't' },
      optedIn()
    );
    expect(cloud.fetchIoSnapshots).toHaveBeenCalledWith({ accessToken: 't' });
    expect(store.import).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedCommit: 'head',
        snapshotsJson: JSON.stringify(snapshots),
      })
    );
    expect(result).toEqual({ status: 'fetched', snapshots: set });
  });

  it('hashes natively when the read fails, with the reason its code gives', async () => {
    for (const [code, reason] of [
      ['ENOTFOUND', 'offline'],
      ['UNAUTHORIZED', 'unauthorized'],
      ['UNSUPPORTED_CLIENT', 'unsupported-client'],
      ['NO_CLOUD_CLIENT', 'no-cloud-client'],
    ]) {
      cloud.fetchIoSnapshots.mockRejectedValueOnce(coded(code, 'x'));
      expect(await loadIoSnapshotsForRun(nxJson, {}, optedIn())).toEqual({
        status: 'skipped',
        reason,
        message: 'x',
      });
    }
    cloud.fetchIoSnapshots.mockRejectedValueOnce(new Error('no code'));
    expect(await loadIoSnapshotsForRun(nxJson, {}, optedIn())).toMatchObject({
      reason: 'fetch-failed',
    });
  });

  it('hashes natively instead of reusing a stale set when the refresh fails', async () => {
    // As the native store behaves: the old set is there, but not young enough.
    store.get.mockImplementation((_commit, maxAgeMs) =>
      maxAgeMs === undefined ? stored() : null
    );
    cloud.fetchIoSnapshots.mockRejectedValueOnce(coded('ENOTFOUND', 'x'));
    expect(await loadIoSnapshotsForRun(nxJson, {}, optedIn())).toEqual({
      status: 'skipped',
      reason: 'offline',
      message: 'x',
    });
    expect(store.get).toHaveBeenCalledTimes(1);
    expect(store.get).toHaveBeenCalledWith('head', 60 * 60 * 1000);
  });

  // Only reasons that point at misconfiguration warn on every run.
  it('warns for an unauthorized read but not when Nx Cloud has no set', async () => {
    cloud.fetchIoSnapshots.mockRejectedValueOnce(coded('NO_SNAPSHOTS'));
    expect(await loadIoSnapshotsForRun(nxJson, {}, optedIn())).toMatchObject({
      reason: 'no-snapshots',
    });
    expect(warn).not.toHaveBeenCalled();

    cloud.fetchIoSnapshots.mockRejectedValueOnce(coded('UNAUTHORIZED'));
    await loadIoSnapshotsForRun(nxJson, {}, optedIn());
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('skips rather than throws when the store cannot be opened', async () => {
    IoSnapshotStore.mockImplementationOnce(function () {
      throw new Error('database disk image is malformed');
    });
    expect(await loadIoSnapshotsForRun(nxJson, {}, optedIn())).toMatchObject({
      status: 'skipped',
      message: 'database disk image is malformed',
    });
    expect(cloud.fetchIoSnapshots).not.toHaveBeenCalled();
  });

  it('skips when the store cannot write what Nx Cloud read', async () => {
    store.import.mockImplementation(() => {
      throw coded('WRITE_FAILED', 'disk full');
    });
    expect(await loadIoSnapshotsForRun(nxJson, {}, optedIn())).toMatchObject({
      status: 'skipped',
      reason: 'write-failed',
    });
  });
});

describe('importIoSnapshots', () => {
  it('stores what the Nx Cloud client read and returns the handle', () => {
    const handle = { commit: 'head' };
    store.import.mockReturnValue(handle);
    const snapshots = {
      'web:build': { commit: 'head', inputs: ['apps/web/**'], outputs: [] },
    };
    expect(importIoSnapshots('head', snapshots)).toBe(handle);
    expect(store.import).toHaveBeenCalledWith({
      requestedCommit: 'head',
      snapshotsJson: JSON.stringify(snapshots),
    });
  });
});

describe('openIoSnapshots', () => {
  it('reopens the stored version by commit and fetch time', () => {
    const handle = { commit: 'head' };
    store.getVersion.mockReturnValue(handle);
    expect(openIoSnapshots('head', 7)).toBe(handle);
    expect(store.getVersion).toHaveBeenCalledWith('head', 7);

    store.getVersion.mockReturnValue(null);
    expect(openIoSnapshots('head', 8)).toBeNull();
  });
});
