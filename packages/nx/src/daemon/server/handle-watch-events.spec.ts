import type { Mock, MockInstance } from 'vitest';
import { EventType, type WatchEvent } from '../../native';

vi.mock('../logger', () => ({
  serverLogger: { watcherLog: vi.fn() },
}));
vi.mock('./project-graph-incremental-recomputation', () => ({
  currentProjectGraph: undefined,
  getRecomputationGeneration: vi.fn(() => 7),
  invalidateGraphCache: vi.fn(),
}));
vi.mock('../../utils/workspace-context', () => ({
  trackedFilesInContext: vi.fn(() => []),
}));
vi.mock('./dotenv-graph-changes', () => ({
  classifyDotEnvChanges: vi.fn(() => ({
    invalidating: [],
    unclassified: [],
  })),
  queuePendingDotEnvEvents: vi.fn(),
}));

describe('handleWatchEvents', () => {
  let handleWatchEvents: typeof import('./handle-watch-events').handleWatchEvents;
  let getWatchTerminalError: typeof import('./handle-watch-events').getWatchTerminalError;
  let recomputation: {
    invalidateGraphCache: Mock;
  };
  let context: { trackedFilesInContext: Mock };
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
    ({ handleWatchEvents, getWatchTerminalError } =
      await import('./handle-watch-events'));
    recomputation =
      (await import('./project-graph-incremental-recomputation')) as any;
    dotenvChanges = (await import('./dotenv-graph-changes')) as any;
    context = (await import('../../utils/workspace-context')) as any;
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('invalidates the graph on a rescan without classifying per-path events', async () => {
    await handleWatchEvents(null, [{ path: '', type: EventType.rescan }]);

    expect(recomputation.invalidateGraphCache).toHaveBeenCalled();
    expect(dotenvChanges.classifyDotEnvChanges).not.toHaveBeenCalled();
    // A rescan is recoverable: the watch stream is still alive.
    expect(getWatchTerminalError()).toBeUndefined();
  });

  it('records a native watcher error as terminal, preserving its message', async () => {
    await handleWatchEvents(
      'inotify_add_watch failed registering new directory watch: limit',
      null
    );

    expect(getWatchTerminalError().message).toContain('inotify_add_watch');
  });

  it('does not record an empty delivery as terminal', async () => {
    await handleWatchEvents(null, []);

    expect(getWatchTerminalError()).toBeUndefined();
  });

  it('invalidates the graph when dotenv classification fails', async () => {
    dotenvChanges.classifyDotEnvChanges.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    await handleWatchEvents(null, events);

    expect(recomputation.invalidateGraphCache).toHaveBeenCalled();
    expect(getWatchTerminalError()).toBeUndefined();
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
    await handleWatchEvents(null, [event]);

    expect(dotenvChanges.queuePendingDotEnvEvents).toHaveBeenCalledWith(
      ['apps/e2e/.env.e2e'],
      7
    );
    expect(recomputation.invalidateGraphCache).not.toHaveBeenCalled();
  });

  it('queues an invalidating edit of a tracked dotenv file instead of invalidating', async () => {
    // The file-change stream schedules the recomputation for a tracked file,
    // but a computation already in flight may have read the file before the
    // edit; only the queued evidence lets the pre-serve replay prove that.
    dotenvChanges.classifyDotEnvChanges.mockReturnValueOnce({
      invalidating: ['libs/foo/.env.e2e'],
      unclassified: [],
    });
    context.trackedFilesInContext.mockReturnValue(['libs/foo/.env.e2e']);
    await handleWatchEvents(null, events);

    expect(dotenvChanges.queuePendingDotEnvEvents).toHaveBeenCalledWith(
      ['libs/foo/.env.e2e'],
      7
    );
    expect(recomputation.invalidateGraphCache).not.toHaveBeenCalled();
  });
});
