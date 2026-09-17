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

import { serializeWithFallback } from '../socket-utils';
import { parseMessage } from '../../utils/consume-messages-from-socket';
import { handleResolveIoSnapshots } from './handle-resolve-io-snapshots';
import { ioSnapshotsForCommit } from './io-snapshots-state';

describe('handleResolveIoSnapshots', () => {
  const payload = {
    type: 'RESOLVE_IO_SNAPSHOTS' as const,
    runnerOptions: { accessToken: 't' },
    ioSnapshotEnv: { NX_IO_SNAPSHOTS_MAX_AGE: '123' },
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
    expect(response).toEqual({
      status: 'fetched',
      reason: '',
      message: '',
      commit: 'head',
    });
  });

  // The client does not parse what the socket already parsed, so the response
  // must survive one encode and one decode — a stringified one arrives as a
  // string and every caller of it throws.
  it.each(['json', 'v8'] as const)(
    'survives the %s socket round trip as an object',
    async (mode) => {
      fetchIoSnapshotsForRun.mockResolvedValue({
        status: 'fetched',
        reason: '',
        message: '',
        commit: 'head',
        resolution: { digest: 'd' },
      });
      const { response } = await handleResolveIoSnapshots(payload);
      expect(parseMessage(serializeWithFallback(response, mode))).toEqual({
        status: 'fetched',
        reason: '',
        message: '',
        commit: 'head',
      });
    }
  );

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

  // `handleClientEnv` reflects a message's `env` onto the daemon's whole
  // process env, deleting every key the message leaves out.
  it('carries the run env under a name the daemon does not reflect', () => {
    expect(Object.keys(payload)).not.toContain('env');
  });

  it('reports nothing stored when snapshots are off for the workspace', async () => {
    fetchIoSnapshotsForRun.mockResolvedValue(null);
    const { response } = await handleResolveIoSnapshots(payload);
    expect(JSON.parse(response)).toBeNull();
  });
});
