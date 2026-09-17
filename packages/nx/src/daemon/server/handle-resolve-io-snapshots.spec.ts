const fetchIoSnapshotsForRun = vi.fn();
// Lazy so the hoisted factory does not touch the const before it exists.
vi.mock('../../io-snapshots/fetch', () => ({
  fetchIoSnapshotsForRun: (...args: unknown[]) =>
    fetchIoSnapshotsForRun(...args),
}));
vi.mock('../../config/configuration', () => ({ readNxJson: () => ({ a: 1 }) }));
const loadIoSnapshots = vi.fn();
vi.mock('../../native', () => ({
  loadIoSnapshots: (db: string, commit: string) => loadIoSnapshots(db, commit),
}));
vi.mock('../../utils/db-connection', () => ({ getDbConnection: () => 'db' }));

import { handleResolveIoSnapshots } from './handle-resolve-io-snapshots';
import { ioSnapshotsForCommit } from './io-snapshots-state';

describe('handleResolveIoSnapshots', () => {
  const payload = {
    type: 'RESOLVE_IO_SNAPSHOTS' as const,
    runnerOptions: { accessToken: 't' },
    env: { NX_IO_SNAPSHOTS_MAX_AGE: '123' },
  };

  beforeEach(() => vi.clearAllMocks());

  it('fetches with the run env and reports what it stored', async () => {
    fetchIoSnapshotsForRun.mockResolvedValue({
      status: 'fetched',
      reason: '',
      message: '',
      commit: 'head',
      resolution: { digest: 'd' },
    });
    const { response } = await handleResolveIoSnapshots(payload);
    expect(fetchIoSnapshotsForRun).toHaveBeenCalledWith(
      { a: 1 },
      { accessToken: 't' },
      { NX_IO_SNAPSHOTS_MAX_AGE: '123' }
    );
    expect(JSON.parse(response)).toEqual({
      status: 'fetched',
      reason: '',
      message: '',
      commit: 'head',
    });
  });

  it('hands hashing the handle it just fetched instead of loading again', async () => {
    const handle = {
      status: 'fetched',
      reason: '',
      message: '',
      commit: 'head',
      resolution: { digest: 'd' },
    };
    fetchIoSnapshotsForRun.mockResolvedValue(handle);
    loadIoSnapshots.mockReturnValue({
      commit: 'head',
      resolution: { digest: 'd' },
    });
    await handleResolveIoSnapshots(payload);
    expect(ioSnapshotsForCommit('head')).toBe(handle);
  });

  it('reports nothing stored when snapshots are off for the workspace', async () => {
    fetchIoSnapshotsForRun.mockResolvedValue(null);
    const { response } = await handleResolveIoSnapshots(payload);
    expect(JSON.parse(response)).toBeNull();
  });
});
