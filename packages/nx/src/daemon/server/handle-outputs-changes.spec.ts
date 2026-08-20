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
  invalidateGraphCache: jest.fn(),
  isKnownWorkspaceFile: jest.fn(() => true),
}));
jest.mock('./dotenv-graph-changes', () => ({
  outputsChangesInvalidatingGraphEnv: jest.fn(() => []),
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
  let dotenvChanges: { outputsChangesInvalidatingGraphEnv: jest.Mock };
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

    dotenvChanges.outputsChangesInvalidatingGraphEnv.mockReturnValue([
      '.env.e2e',
    ]);
    recomputation.isKnownWorkspaceFile.mockReturnValue(false);
    await handleOutputsChanges(null, events);

    expect(recomputation.invalidateGraphCache).toHaveBeenCalled();
    expect(getOutputsWatcherTerminalError()).toBeUndefined();
    expect(outputsTracking.processFileChangesInOutputs).toHaveBeenCalledTimes(
      1
    );
  });
});
