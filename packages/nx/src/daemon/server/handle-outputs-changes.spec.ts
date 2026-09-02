import type { Mock, MockInstance } from 'vitest';
import { EventType, type WatchEvent } from '../../native';

vi.mock('../logger', () => ({
  serverLogger: { watcherLog: vi.fn() },
}));
vi.mock('./outputs-tracking', () => ({
  clearRecordedOutputsHashes: vi.fn(),
  disableOutputsTracking: vi.fn(),
  processFileChangesInOutputs: vi.fn(),
}));
vi.mock('./project-graph-incremental-recomputation', () => ({
  currentProjectGraph: undefined,
  getRecomputationGeneration: vi.fn(() => 7),
  invalidateGraphCache: vi.fn(),
  isKnownWorkspaceFile: vi.fn(() => true),
}));
vi.mock('./dotenv-graph-changes', () => ({
  classifyDotEnvChanges: vi.fn(() => ({
    invalidating: [],
    unclassified: [],
  })),
  queuePendingDotEnvEvents: vi.fn(),
}));

describe('handleOutputsChanges', () => {
  let handleOutputsChanges: typeof import('./handle-outputs-changes').handleOutputsChanges;
  let getOutputsWatcherTerminalError: typeof import('./handle-outputs-changes').getOutputsWatcherTerminalError;
  let outputsTracking: {
    clearRecordedOutputsHashes: Mock;
    disableOutputsTracking: Mock;
    processFileChangesInOutputs: Mock;
  };
  let recomputation: {
    invalidateGraphCache: Mock;
    isKnownWorkspaceFile: Mock;
  };
  let dotenvChanges: {
    classifyDotEnvChanges: Mock;
    queuePendingDotEnvEvents: Mock;
  };
  let consoleError: MockInstance;

  const events: WatchEvent[] = [{ path: '.env.e2e', type: EventType.update }];

  beforeEach(async () => {
    // The watcher error flags are module state, so each test gets a fresh
    // module registry. resetModules does not re-run the vi.mock factories, so
    // the mock fns persist across tests and their recorded calls are cleared.
    vi.resetModules();
    vi.clearAllMocks();
    ({ handleOutputsChanges, getOutputsWatcherTerminalError } =
      await import('./handle-outputs-changes'));
    outputsTracking = (await import('./outputs-tracking')) as any;
    recomputation =
      (await import('./project-graph-incremental-recomputation')) as any;
    dotenvChanges = (await import('./dotenv-graph-changes')) as any;
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('starts the tracker over and invalidates the graph on a rescan, without processing per-path events', async () => {
    await handleOutputsChanges(null, [{ path: '', type: EventType.rescan }]);

    expect(outputsTracking.clearRecordedOutputsHashes).toHaveBeenCalled();
    expect(recomputation.invalidateGraphCache).toHaveBeenCalled();
    expect(outputsTracking.processFileChangesInOutputs).not.toHaveBeenCalled();
    expect(dotenvChanges.classifyDotEnvChanges).not.toHaveBeenCalled();
    // A rescan is recoverable: the watch stream is still alive.
    expect(getOutputsWatcherTerminalError()).toBeUndefined();
    expect(outputsTracking.disableOutputsTracking).not.toHaveBeenCalled();
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
