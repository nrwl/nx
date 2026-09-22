import { resolveIoSnapshotsForRun } from './resolve';

const daemon = vi.hoisted(() => ({
  enabled: vi.fn(() => true),
  resolveIoSnapshots: vi.fn(),
}));
const native = vi.hoisted(() => ({
  loadIoSnapshots: vi.fn(),
  skippedIoSnapshots: vi.fn((reason: string, message: string) => ({
    status: 'skipped',
    reason,
    message,
  })),
}));
const fetched = vi.hoisted(() => ({
  fetchIoSnapshotsForRun: vi.fn(),
  isIoSnapshotFetchEnabled: vi.fn(() => true),
}));

vi.mock('../daemon/client/client', () => ({ daemonClient: daemon }));
vi.mock('../native', () => native);
vi.mock('../utils/db-connection', () => ({ getDbConnection: () => 'db' }));
vi.mock('./config', () => ({
  isIoSnapshotFetchEnabled: fetched.isIoSnapshotFetchEnabled,
  ioSnapshotEnv: () => ({ NX_IO_SNAPSHOTS: 'true' }),
}));
vi.mock('./fetch', () => ({
  fetchIoSnapshotsForRun: fetched.fetchIoSnapshotsForRun,
  reportIoSnapshotResolution: (result: unknown) => result,
}));

describe('resolveIoSnapshotsForRun', () => {
  const nxJson = {} as any;
  const stored = { status: 'cached', reason: null };

  beforeEach(() => {
    vi.clearAllMocks();
    daemon.enabled.mockReturnValue(true);
    fetched.isIoSnapshotFetchEnabled.mockReturnValue(true);
    native.loadIoSnapshots.mockReturnValue(stored);
  });

  it('lets the daemon fetch and store, then reads the stored set back', async () => {
    daemon.resolveIoSnapshots.mockResolvedValue({
      status: 'fetched',
      reason: '',
      message: '',
      commit: 'head',
    });
    const result = await resolveIoSnapshotsForRun(nxJson, { accessToken: 't' });
    expect(daemon.resolveIoSnapshots).toHaveBeenCalledWith(
      { accessToken: 't' },
      { NX_IO_SNAPSHOTS: 'true' }
    );
    // The fetch itself belongs to the daemon.
    expect(fetched.fetchIoSnapshotsForRun).not.toHaveBeenCalled();
    expect(native.loadIoSnapshots).toHaveBeenCalledWith(
      'db',
      'head',
      undefined,
      undefined
    );
    expect(result).toBe(stored);
  });

  it('keeps the reason the daemon gives when it stored nothing', async () => {
    daemon.resolveIoSnapshots.mockResolvedValue({
      status: 'skipped',
      reason: 'offline',
      message: 'ENOTFOUND',
    });
    expect(await resolveIoSnapshotsForRun(nxJson, {})).toMatchObject({
      status: 'skipped',
      reason: 'offline',
    });
    expect(native.loadIoSnapshots).not.toHaveBeenCalled();
  });

  it('carries the daemon reason into the local load', async () => {
    daemon.resolveIoSnapshots.mockResolvedValue({
      status: 'cached',
      reason: 'no-bundle',
      message: 'nothing stored yet',
      commit: 'head',
    });
    await resolveIoSnapshotsForRun(nxJson, {});
    expect(native.loadIoSnapshots).toHaveBeenCalledWith(
      'db',
      'head',
      'no-bundle',
      'nothing stored yet'
    );
  });

  it('fetches in this process when the daemon cannot answer', async () => {
    daemon.resolveIoSnapshots.mockRejectedValue(new Error('socket closed'));
    fetched.fetchIoSnapshotsForRun.mockResolvedValue(stored);
    expect(await resolveIoSnapshotsForRun(nxJson, {})).toBe(stored);
    expect(fetched.fetchIoSnapshotsForRun).toHaveBeenCalled();
  });

  it('fetches in this process when the daemon is off', async () => {
    daemon.enabled.mockReturnValue(false);
    fetched.fetchIoSnapshotsForRun.mockResolvedValue(stored);
    expect(await resolveIoSnapshotsForRun(nxJson, {})).toBe(stored);
    expect(daemon.resolveIoSnapshots).not.toHaveBeenCalled();
  });

  it('does not ask the daemon when snapshots are not enabled', async () => {
    fetched.isIoSnapshotFetchEnabled.mockReturnValue(false);
    expect(await resolveIoSnapshotsForRun(nxJson, {})).toBeNull();
    expect(daemon.resolveIoSnapshots).not.toHaveBeenCalled();
    expect(fetched.fetchIoSnapshotsForRun).not.toHaveBeenCalled();
  });
});
