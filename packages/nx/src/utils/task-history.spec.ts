import { TaskHistory } from './task-history';

const mocks = vi.hoisted(() => {
  const connection = {};
  const nativeHistory = {
    getEstimatedTaskTimings: vi.fn(),
    getFlakyTasks: vi.fn(),
    recordTaskRuns: vi.fn(),
  };
  return {
    connection,
    nativeHistory,
    constructor: vi.fn(function () {
      return nativeHistory;
    }),
    daemon: {
      enabled: vi.fn(() => true),
      getEstimatedTaskTimings: vi.fn(),
      getFlakyTasks: vi.fn(),
      recordTaskRuns: vi.fn(),
    },
  };
});

vi.mock('../native', () => ({
  IS_WASM: false,
  NxTaskHistory: mocks.constructor,
}));
vi.mock('./db-connection', () => ({ getDbConnection: () => mocks.connection }));
vi.mock('../daemon/client/client', () => ({ daemonClient: mocks.daemon }));
vi.mock('../daemon/is-on-daemon', () => ({ isOnDaemon: () => false }));

describe('TaskHistory database ownership', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the client connection for reads and writes even when a daemon is enabled', async () => {
    const history = new TaskHistory();
    const targets = [{ project: 'app', target: 'build' }];
    const hashes = ['client-only-hash'];
    const runs = [
      { hash: hashes[0], status: 'success', code: 0, start: 100, end: 200 },
    ];
    mocks.nativeHistory.getEstimatedTaskTimings.mockReturnValue({
      'app:build': 100,
    });
    mocks.nativeHistory.getFlakyTasks.mockReturnValue(hashes);

    expect(mocks.constructor).toHaveBeenCalledWith(mocks.connection);
    await expect(history.getEstimatedTaskTimings(targets)).resolves.toEqual({
      'app:build': 100,
    });
    await expect(history.getFlakyTasks(hashes)).resolves.toEqual(hashes);
    await history.recordTaskRuns(runs);
    expect(mocks.nativeHistory.getEstimatedTaskTimings).toHaveBeenCalledWith(
      targets
    );
    expect(mocks.nativeHistory.getFlakyTasks).toHaveBeenCalledWith(hashes);
    expect(mocks.nativeHistory.recordTaskRuns).toHaveBeenCalledWith(runs);
    expect(mocks.daemon.getEstimatedTaskTimings).not.toHaveBeenCalled();
    expect(mocks.daemon.getFlakyTasks).not.toHaveBeenCalled();
    expect(mocks.daemon.recordTaskRuns).not.toHaveBeenCalled();
  });

  it('does not suppress a native history transaction failure', async () => {
    const history = new TaskHistory();
    const failure = new Error('FOREIGN KEY constraint failed');
    mocks.nativeHistory.recordTaskRuns.mockImplementationOnce(() => {
      throw failure;
    });
    await expect(history.recordTaskRuns([])).rejects.toBe(failure);
  });
});
