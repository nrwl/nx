const loadIoSnapshotsForRun = vi.fn();
// Lazy so the hoisted factory does not touch the const before it exists.
vi.mock('../../io-snapshots/store', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  loadIoSnapshotsForRun: (...args: unknown[]) => loadIoSnapshotsForRun(...args),
}));
vi.mock('../../config/configuration', () => ({ readNxJson: () => ({ a: 1 }) }));
const getStored = vi.fn();
vi.mock('../../native', () => ({
  IoSnapshotStore: vi.fn(function () {
    return {
      getVersion: (commit: string, fetchedAt: number) =>
        getStored(commit, fetchedAt),
    };
  }),
}));
vi.mock('../../utils/db-connection', () => ({ getDbConnection: () => 'db' }));

import { serializeWithFallback } from '../socket-utils';
import { parseMessage } from '../../utils/consume-messages-from-socket';
import { handleResolveIoSnapshots } from './handle-resolve-io-snapshots';
import { getIoSnapshotsForVersion } from './io-snapshots-state';

describe('handleResolveIoSnapshots', () => {
  const payload = {
    type: 'RESOLVE_IO_SNAPSHOTS' as const,
    runnerOptions: { accessToken: 't' },
    ioSnapshotEnv: { NX_IO_SNAPSHOTS: 'true' },
  };

  const set = { commit: 'head', resolution: { fetchedAt: 1 } };

  beforeEach(() => vi.clearAllMocks());

  it('fetches with the run env and reports what it stored', async () => {
    loadIoSnapshotsForRun.mockResolvedValue({
      status: 'fetched',
      snapshots: set,
    });
    const { response } = await handleResolveIoSnapshots(payload);
    expect(loadIoSnapshotsForRun).toHaveBeenCalledWith(
      { a: 1 },
      { accessToken: 't' },
      { NX_IO_SNAPSHOTS: 'true' }
    );
    expect(response).toEqual({
      status: 'fetched',
      commit: 'head',
      fetchedAt: 1,
    });
  });

  // The client returns what the socket layer parsed, so the response must
  // come back as the object the caller reads fields off.
  it.each(['json', 'v8'] as const)(
    'survives the %s socket round trip as an object',
    async (mode) => {
      loadIoSnapshotsForRun.mockResolvedValue({
        status: 'fetched',
        snapshots: set,
      });
      const { response } = await handleResolveIoSnapshots(payload);
      expect(parseMessage(serializeWithFallback(response, mode))).toEqual({
        status: 'fetched',
        commit: 'head',
        fetchedAt: 1,
      });
    }
  );

  it('hands hashing the set it just fetched instead of reading it again', async () => {
    loadIoSnapshotsForRun.mockResolvedValue({
      status: 'fetched',
      snapshots: set,
    });
    await handleResolveIoSnapshots(payload);
    expect(getIoSnapshotsForVersion({ commit: 'head', fetchedAt: 1 })).toBe(
      set
    );
    expect(getStored).not.toHaveBeenCalled();
  });

  it('shares one load between requests that arrive while it is under way', async () => {
    let finish: (outcome: unknown) => void;
    loadIoSnapshotsForRun.mockReturnValueOnce(
      new Promise((resolve) => (finish = resolve))
    );
    const first = handleResolveIoSnapshots(payload);
    const second = handleResolveIoSnapshots(payload);
    finish({ status: 'fetched', snapshots: set });
    expect((await first).response).toEqual((await second).response);
    expect(loadIoSnapshotsForRun).toHaveBeenCalledTimes(1);

    // Settled loads are not reused: the store decides what is fresh.
    loadIoSnapshotsForRun.mockResolvedValue({
      status: 'cached',
      snapshots: set,
    });
    await handleResolveIoSnapshots(payload);
    expect(loadIoSnapshotsForRun).toHaveBeenCalledTimes(2);
  });

  it('does not share a load between requests with different credentials', async () => {
    loadIoSnapshotsForRun.mockResolvedValue(null);
    await Promise.all([
      handleResolveIoSnapshots(payload),
      handleResolveIoSnapshots({
        ...payload,
        runnerOptions: { accessToken: 'other' },
      }),
    ]);
    expect(loadIoSnapshotsForRun).toHaveBeenCalledTimes(2);
  });

  it('passes a skip through as it came', async () => {
    const skipped = { status: 'skipped', reason: 'offline', message: 'x' };
    loadIoSnapshotsForRun.mockResolvedValue(skipped);
    const { response } = await handleResolveIoSnapshots(payload);
    expect(response).toEqual(skipped);
  });

  it.each(['json', 'v8'] as const)(
    'reports nothing stored when snapshots are off for the workspace (%s)',
    async (mode) => {
      loadIoSnapshotsForRun.mockResolvedValue(null);
      const { response } = await handleResolveIoSnapshots(payload);
      expect(response).toBeNull();
      expect(parseMessage(serializeWithFallback(response, mode))).toBeNull();
    }
  );
});
