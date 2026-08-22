import { EventType, type WatchEvent } from '../../native';

jest.mock('../logger', () => ({
  serverLogger: { watcherLog: jest.fn() },
}));
jest.mock('./outputs-tracking', () => ({
  disableOutputsTracking: jest.fn(),
  processFileChangesInOutputs: jest.fn(),
}));
jest.mock('./project-graph-incremental-recomputation', () => ({
  currentProjectGraph: undefined,
  getRecomputationGeneration: jest.fn(() => 7),
  invalidateGraphCache: jest.fn(),
  isKnownWorkspaceFile: jest.fn(() => true),
}));
jest.mock('./dotenv-graph-changes', () => ({
  classifyDotEnvChanges: jest.fn(() => ({
    invalidating: [],
    unclassified: [],
  })),
  queuePendingDotEnvEvents: jest.fn(),
}));

describe('handleOutputsChanges', () => {
  let handleOutputsChanges: typeof import('./handle-outputs-changes').handleOutputsChanges;
  let getOutputsWatcherTerminalError: typeof import('./handle-outputs-changes').getOutputsWatcherTerminalError;
  let outputsTracking: {
    disableOutputsTracking: jest.Mock;
    processFileChangesInOutputs: jest.Mock;
  };
  let recomputation: {
    invalidateGraphCache: jest.Mock;
    isKnownWorkspaceFile: jest.Mock;
  };
  let dotenvChanges: {
    classifyDotEnvChanges: jest.Mock;
    queuePendingDotEnvEvents: jest.Mock;
  };
  let consoleError: jest.SpyInstance;

  const events: WatchEvent[] = [{ path: '.env.e2e', type: EventType.update }];

  beforeEach(() => {
    // The watcher error flags are module state, so each test gets a fresh
    // module registry, with the mocks re-required from the same registry the
    // module under test resolves.
    jest.resetModules();
    ({ handleOutputsChanges, getOutputsWatcherTerminalError } =
      require('./handle-outputs-changes') as typeof import('./handle-outputs-changes'));
    outputsTracking = require('./outputs-tracking');
    recomputation = require('./project-graph-incremental-recomputation');
    dotenvChanges = require('./dotenv-graph-changes');
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('records a native watcher error as terminal, preserving its message, and disables outputs tracking', async () => {
    await handleOutputsChanges(
      'inotify_add_watch failed registering new directory watch: limit',
      null
    );

    expect(getOutputsWatcherTerminalError().message).toContain(
      'inotify_add_watch'
    );
    expect(outputsTracking.disableOutputsTracking).toHaveBeenCalled();
  });

  it('does not record an empty delivery as terminal', async () => {
    await handleOutputsChanges(null, []);

    expect(getOutputsWatcherTerminalError()).toBeUndefined();
    expect(outputsTracking.disableOutputsTracking).toHaveBeenCalled();
  });

  it('keeps invalidating the graph for dotenv edits after a processing failure, which is not terminal', async () => {
    // A processing failure happens with the native watcher still alive, so
    // later events keep arriving; only their outputs processing stays off.
    outputsTracking.processFileChangesInOutputs.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    await handleOutputsChanges(null, events);

    expect(getOutputsWatcherTerminalError()).toBeUndefined();
    expect(outputsTracking.disableOutputsTracking).toHaveBeenCalled();

    dotenvChanges.classifyDotEnvChanges.mockReturnValue({
      invalidating: ['.env.e2e'],
      unclassified: [],
    });
    recomputation.isKnownWorkspaceFile.mockReturnValue(false);
    await handleOutputsChanges(null, events);

    expect(recomputation.invalidateGraphCache).toHaveBeenCalled();
    expect(getOutputsWatcherTerminalError()).toBeUndefined();
    expect(outputsTracking.processFileChangesInOutputs).toHaveBeenCalledTimes(
      1
    );
  });

  it('forwards unclassified dotenv events to the pending queue without invalidating', async () => {
    const event: WatchEvent = {
      path: 'apps/e2e/.env.e2e',
      type: EventType.update,
    };
    dotenvChanges.classifyDotEnvChanges.mockReturnValueOnce({
      invalidating: [],
      unclassified: [event],
    });
    await handleOutputsChanges(null, [event]);

    expect(dotenvChanges.queuePendingDotEnvEvents).toHaveBeenCalledWith(
      ['apps/e2e/.env.e2e'],
      7
    );
    expect(recomputation.invalidateGraphCache).not.toHaveBeenCalled();
  });

  it('queues an invalidating edit of a tracked dotenv file instead of invalidating', async () => {
    // The workspace watcher schedules the recomputation for a tracked file,
    // but a computation already in flight may have read the file before the
    // edit; only the queued evidence lets the pre-serve replay prove that.
    dotenvChanges.classifyDotEnvChanges.mockReturnValueOnce({
      invalidating: ['libs/foo/.env.e2e'],
      unclassified: [],
    });
    recomputation.isKnownWorkspaceFile.mockReturnValue(true);
    await handleOutputsChanges(null, events);

    expect(dotenvChanges.queuePendingDotEnvEvents).toHaveBeenCalledWith(
      ['libs/foo/.env.e2e'],
      7
    );
    expect(recomputation.invalidateGraphCache).not.toHaveBeenCalled();
  });
});
