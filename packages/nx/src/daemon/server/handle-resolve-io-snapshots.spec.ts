const fetchIoSnapshotsForRun = vi.fn();
// Lazy so the hoisted factory does not touch the const before it exists.
vi.mock('../../io-snapshots/fetch', () => ({
  fetchIoSnapshotsForRun: (...args: unknown[]) =>
    fetchIoSnapshotsForRun(...args),
}));
vi.mock('../../config/configuration', () => ({ readNxJson: () => ({ a: 1 }) }));
const getStored = vi.fn();
vi.mock('../../native', () => ({
  IoSnapshotStore: vi.fn(function () {
    return { get: (commit: string) => getStored(commit) };
  }),
}));
vi.mock('../../utils/db-connection', () => ({ getDbConnection: () => 'db' }));

import { serializeWithFallback } from '../socket-utils';
import { parseMessage } from '../../utils/consume-messages-from-socket';
import { handleResolveIoSnapshots } from './handle-resolve-io-snapshots';
import { getIoSnapshotsForCommit } from './io-snapshots-state';

describe('handleResolveIoSnapshots', () => {
  const payload = {
    type: 'RESOLVE_IO_SNAPSHOTS' as const,
    runnerOptions: { accessToken: 't' },
    ioSnapshotEnv: { NX_IO_SNAPSHOTS: 'true' },
  };

  const set = { commit: 'head', resolution: { digest: 'd' } };

  beforeEach(() => vi.clearAllMocks());

  it('fetches with the run env and reports what it stored', async () => {
    fetchIoSnapshotsForRun.mockResolvedValue({
      status: 'fetched',
      snapshots: set,
    });
    const { response } = await handleResolveIoSnapshots(payload);
    expect(fetchIoSnapshotsForRun).toHaveBeenCalledWith(
      { a: 1 },
      { accessToken: 't' },
      { NX_IO_SNAPSHOTS: 'true' }
    );
    expect(response).toEqual({ status: 'fetched', commit: 'head' });
  });

  // The client returns what the socket layer parsed, so the response must
  // come back as the object the caller reads fields off.
  it.each(['json', 'v8'] as const)(
    'survives the %s socket round trip as an object',
    async (mode) => {
      fetchIoSnapshotsForRun.mockResolvedValue({
        status: 'fetched',
        snapshots: set,
      });
      const { response } = await handleResolveIoSnapshots(payload);
      expect(parseMessage(serializeWithFallback(response, mode))).toEqual({
        status: 'fetched',
        commit: 'head',
      });
    }
  );

  it('hands hashing the set it just fetched instead of reading it again', async () => {
    fetchIoSnapshotsForRun.mockResolvedValue({
      status: 'fetched',
      snapshots: set,
    });
    getStored.mockReturnValue({ commit: 'head', resolution: { digest: 'd' } });
    await handleResolveIoSnapshots(payload);
    expect(getIoSnapshotsForCommit('head')).toBe(set);
  });

  it('passes a skip through as it came', async () => {
    const skipped = { status: 'skipped', reason: 'offline', message: 'x' };
    fetchIoSnapshotsForRun.mockResolvedValue(skipped);
    const { response } = await handleResolveIoSnapshots(payload);
    expect(response).toEqual(skipped);
  });

  // `handleClientEnv` reflects a message's `env` onto the daemon's whole
  // process env, deleting every key the message leaves out.
  it('carries the run env under a name the daemon does not reflect', () => {
    expect(Object.keys(payload)).not.toContain('env');
  });

  it.each(['json', 'v8'] as const)(
    'reports nothing stored when snapshots are off for the workspace (%s)',
    async (mode) => {
      fetchIoSnapshotsForRun.mockResolvedValue(null);
      const { response } = await handleResolveIoSnapshots(payload);
      expect(response).toBeNull();
      expect(parseMessage(serializeWithFallback(response, mode))).toBeNull();
    }
  );
});
