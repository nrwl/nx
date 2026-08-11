import { getPluginsIfLoadedOrLoading } from '../../project-graph/plugins/get-plugins';
import { applyDaemonEnvFromClient } from '../client/daemon-environment';
import { serverLogger } from '../logger';
import { handleClientEnv } from './handle-client-env';
import {
  invalidateGraphCache,
  markInFlightRecomputationsStale,
} from './project-graph-incremental-recomputation';

jest.mock('../client/daemon-environment', () => ({
  applyDaemonEnvFromClient: jest.fn(),
}));
jest.mock('../../project-graph/plugins/get-plugins', () => ({
  getPluginsIfLoadedOrLoading: jest.fn(),
}));
jest.mock('./project-graph-incremental-recomputation', () => ({
  invalidateGraphCache: jest.fn(),
  markInFlightRecomputationsStale: jest.fn(),
}));
jest.mock('../logger', () => ({
  serverLogger: { log: jest.fn() },
}));

describe('handleClientEnv', () => {
  const env = { FOO: 'bar' };

  beforeEach(() => {
    jest.clearAllMocks();
    (applyDaemonEnvFromClient as jest.Mock).mockReturnValue(['FOO']);
    (getPluginsIfLoadedOrLoading as jest.Mock).mockReturnValue(undefined);
  });

  it('does nothing beyond applying the env when no keys changed', async () => {
    (applyDaemonEnvFromClient as jest.Mock).mockReturnValue([]);

    await handleClientEnv(env);

    expect(applyDaemonEnvFromClient).toHaveBeenCalledWith(env);
    expect(getPluginsIfLoadedOrLoading).not.toHaveBeenCalled();
    expect(invalidateGraphCache).not.toHaveBeenCalled();
    expect(markInFlightRecomputationsStale).not.toHaveBeenCalled();
  });

  it('awaits worker forwarding before discarding the cached graph', async () => {
    let resolveForward: () => void = () => {};
    const setWorkerEnv = jest.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        resolveForward = resolve;
      })
    );
    (getPluginsIfLoadedOrLoading as jest.Mock).mockReturnValue(
      Promise.resolve([{ name: 'a', setWorkerEnv }])
    );

    const done = handleClientEnv(env);
    await Promise.resolve();
    expect(setWorkerEnv).toHaveBeenCalledWith(env);
    expect(invalidateGraphCache).not.toHaveBeenCalled();
    expect(markInFlightRecomputationsStale).not.toHaveBeenCalled();

    resolveForward();
    await done;
    expect(invalidateGraphCache).toHaveBeenCalled();
    expect(markInFlightRecomputationsStale).toHaveBeenCalled();
  });

  it('settles when a worker fails to receive the env', async () => {
    (getPluginsIfLoadedOrLoading as jest.Mock).mockReturnValue(
      Promise.resolve([
        {
          name: 'dead',
          setWorkerEnv: jest.fn().mockRejectedValue(new Error('worker exited')),
        },
        { name: 'alive', setWorkerEnv: jest.fn().mockResolvedValue(undefined) },
      ])
    );

    await handleClientEnv(env);

    expect(serverLogger.log).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to forward env to plugin worker "dead": worker exited'
      )
    );
    expect(invalidateGraphCache).toHaveBeenCalled();
    expect(markInFlightRecomputationsStale).toHaveBeenCalled();
  });

  it('discards the cached graph even when no plugins are loaded', async () => {
    await handleClientEnv(env);

    expect(invalidateGraphCache).toHaveBeenCalled();
    expect(markInFlightRecomputationsStale).toHaveBeenCalled();
  });

  it('settles when an in-flight plugin load fails', async () => {
    (getPluginsIfLoadedOrLoading as jest.Mock).mockReturnValue(
      Promise.reject(new Error('load failed'))
    );

    await expect(handleClientEnv(env)).resolves.toBeUndefined();
    expect(invalidateGraphCache).toHaveBeenCalled();
    expect(markInFlightRecomputationsStale).toHaveBeenCalled();
  });

  it('skips plugins without a worker to forward to', async () => {
    (getPluginsIfLoadedOrLoading as jest.Mock).mockReturnValue(
      Promise.resolve([{ name: 'in-process' }])
    );

    await expect(handleClientEnv(env)).resolves.toBeUndefined();
    expect(invalidateGraphCache).toHaveBeenCalled();
  });
});
