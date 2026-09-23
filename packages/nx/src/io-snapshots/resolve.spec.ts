import { resolveIoSnapshotsForRun } from './resolve';

const daemon = vi.hoisted(() => ({
  enabled: vi.fn(() => true),
  resolveIoSnapshots: vi.fn(),
}));
const store = vi.hoisted(() => ({ get: vi.fn() }));
const fetched = vi.hoisted(() => ({
  loadIoSnapshotsForRun: vi.fn(),
  isIoSnapshotFetchEnabled: vi.fn(() => true),
}));

vi.mock('../daemon/client/client', () => ({ daemonClient: daemon }));
vi.mock('./config', () => ({
  isIoSnapshotFetchEnabled: fetched.isIoSnapshotFetchEnabled,
  ioSnapshotEnv: () => ({ NX_IO_SNAPSHOTS: 'true' }),
}));
vi.mock('./store', () => ({
  getIoSnapshotStore: () => store,
  loadIoSnapshotsForRun: fetched.loadIoSnapshotsForRun,
  reportIoSnapshotResolution: (result: unknown) => result,
  skippedIoSnapshots: (reason: string, message: string) => ({
    status: 'skipped',
    reason,
    message,
  }),
}));

describe('resolveIoSnapshotsForRun', () => {
  const nxJson = {} as any;
  const set = { commit: 'head', resolution: { fetchedAt: 1 } };
  const stored = { status: 'cached', snapshots: set };

  beforeEach(() => {
    vi.clearAllMocks();
    daemon.enabled.mockReturnValue(true);
    fetched.isIoSnapshotFetchEnabled.mockReturnValue(true);
    store.get.mockReturnValue(set);
  });

  it('lets the daemon fetch and store, then reads the stored set back', async () => {
    daemon.resolveIoSnapshots.mockResolvedValue({
      status: 'fetched',
      commit: 'head',
    });
    const result = await resolveIoSnapshotsForRun(nxJson, { accessToken: 't' });
    expect(daemon.resolveIoSnapshots).toHaveBeenCalledWith(
      { accessToken: 't' },
      { NX_IO_SNAPSHOTS: 'true' }
    );
    // The fetch itself belongs to the daemon.
    expect(fetched.loadIoSnapshotsForRun).not.toHaveBeenCalled();
    expect(store.get).toHaveBeenCalledWith('head');
    // The status is the daemon's: it fetched, this process only read.
    expect(result).toEqual({ status: 'fetched', snapshots: set });
  });

  it('keeps the reason the daemon gives when it stored nothing', async () => {
    daemon.resolveIoSnapshots.mockResolvedValue({
      status: 'skipped',
      reason: 'offline',
      message: 'ENOTFOUND',
    });
    expect(await resolveIoSnapshotsForRun(nxJson, {})).toEqual({
      status: 'skipped',
      reason: 'offline',
      message: 'ENOTFOUND',
    });
    expect(store.get).not.toHaveBeenCalled();
  });

  it('skips rather than throws when the store cannot be opened', async () => {
    daemon.resolveIoSnapshots.mockResolvedValue({
      status: 'fetched',
      commit: 'head',
    });
    store.get.mockImplementationOnce(() => {
      throw new Error('database disk image is malformed');
    });
    expect(await resolveIoSnapshotsForRun(nxJson, {})).toEqual({
      status: 'skipped',
      reason: 'store-unavailable',
      message: 'database disk image is malformed',
    });
  });

  it('skips when the commit the daemon named is not stored', async () => {
    daemon.resolveIoSnapshots.mockResolvedValue({
      status: 'cached',
      commit: 'head',
    });
    store.get.mockReturnValue(null);
    expect(await resolveIoSnapshotsForRun(nxJson, {})).toMatchObject({
      status: 'skipped',
      reason: 'no-bundle',
    });
  });

  it('fetches in this process when the daemon cannot answer', async () => {
    daemon.resolveIoSnapshots.mockRejectedValue(new Error('socket closed'));
    fetched.loadIoSnapshotsForRun.mockResolvedValue(stored);
    expect(await resolveIoSnapshotsForRun(nxJson, {})).toBe(stored);
    expect(fetched.loadIoSnapshotsForRun).toHaveBeenCalled();
  });

  it('fetches in this process when the daemon is off', async () => {
    daemon.enabled.mockReturnValue(false);
    fetched.loadIoSnapshotsForRun.mockResolvedValue(stored);
    expect(await resolveIoSnapshotsForRun(nxJson, {})).toBe(stored);
    expect(daemon.resolveIoSnapshots).not.toHaveBeenCalled();
  });

  it('does not ask the daemon when snapshots are not enabled', async () => {
    fetched.isIoSnapshotFetchEnabled.mockReturnValue(false);
    expect(await resolveIoSnapshotsForRun(nxJson, {})).toBeNull();
    expect(daemon.resolveIoSnapshots).not.toHaveBeenCalled();
    expect(fetched.loadIoSnapshotsForRun).not.toHaveBeenCalled();
  });
});
