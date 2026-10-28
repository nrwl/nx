import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import type { Mock } from 'vitest';
import { getPluginsIfLoadedOrLoading } from '../../project-graph/plugins/get-plugins';
import {
  applyDaemonEnvFromClient,
  getAppliedDaemonClientEnv,
  getLiveClientBerryEnv,
} from '../client/daemon-environment';
import { serverLogger } from '../logger';
import { handleClientEnv, _setEnvForwardTimeoutMs } from './handle-client-env';
import { invalidateGraphCache } from './project-graph-incremental-recomputation';

vi.mock('../client/daemon-environment', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../client/daemon-environment')>();
  return {
    applyDaemonEnvFromClient: vi.fn(),
    getAppliedDaemonClientEnv: vi.fn(),
    getChangedEnvKeys: actual.getChangedEnvKeys,
    hasBerryBinFolders: actual.hasBerryBinFolders,
    normalizeDaemonEnvironmentForGraph:
      actual.normalizeDaemonEnvironmentForGraph,
    getLiveClientBerryEnv: actual.getLiveClientBerryEnv,
    setLiveClientBerryEnv: actual.setLiveClientBerryEnv,
    withoutBerryBinFolders: actual.withoutBerryBinFolders,
    withoutBerryBinFoldersOnPath: actual.withoutBerryBinFoldersOnPath,
    withTrustedBerryBinFolders: actual.withTrustedBerryBinFolders,
  };
});
vi.mock('../../project-graph/plugins/get-plugins', () => ({
  getPluginsIfLoadedOrLoading: vi.fn(),
}));
vi.mock('./project-graph-incremental-recomputation', () => ({
  invalidateGraphCache: vi.fn(),
}));
vi.mock('../logger', () => ({
  serverLogger: { log: vi.fn() },
}));

describe('handleClientEnv', () => {
  const env = { FOO: 'bar' };
  const flushMicrotasks = () => new Promise(setImmediate);

  beforeEach(() => {
    vi.clearAllMocks();
    (applyDaemonEnvFromClient as Mock).mockReturnValue(['FOO']);
    (getAppliedDaemonClientEnv as Mock).mockReturnValue({
      sequence: 0,
      env: {},
    });
    (getPluginsIfLoadedOrLoading as Mock).mockReturnValue(undefined);
  });

  it('keeps the cached graph when only the Yarn Berry runtime folder rotated', async () => {
    const firstBerry = '/tmp/xfs-aaa';
    const secondBerry = '/tmp/xfs-bbb';
    (getAppliedDaemonClientEnv as Mock).mockReturnValue({
      sequence: 1,
      env: {
        BERRY_BIN_FOLDER: firstBerry,
        PATH: [firstBerry, '/usr/bin'].join(delimiter),
      },
    });
    (applyDaemonEnvFromClient as Mock).mockReturnValue([
      'BERRY_BIN_FOLDER',
      'PATH',
    ]);
    const setWorkerEnv = vi.fn().mockResolvedValue(undefined);
    (getPluginsIfLoadedOrLoading as Mock).mockReturnValue(
      Promise.resolve([{ name: 'a', setWorkerEnv }])
    );

    await handleClientEnv({
      BERRY_BIN_FOLDER: secondBerry,
      PATH: [secondBerry, '/usr/bin'].join(delimiter),
    });

    // Workers still need the fresh wrapper folder; the graph does not.
    expect(setWorkerEnv).toHaveBeenCalled();
    expect(invalidateGraphCache).not.toHaveBeenCalled();
    expect(serverLogger.log).toHaveBeenCalledWith(
      expect.stringContaining('graph identity is unchanged')
    );
  });

  it('discards the cached graph for a client change a config write already matches', async () => {
    // With plugins running in the daemon, a config can write the value the
    // next client sends before that client's env arrives; process.env then
    // has nothing to move on, but the graph in flight was computed under the
    // previous client and must not be served to this one.
    const actual = await vi.importActual<
      typeof import('../client/daemon-environment')
    >('../client/daemon-environment');
    (applyDaemonEnvFromClient as Mock).mockImplementation(
      actual.applyDaemonEnvFromClient
    );
    const originalEnv = process.env;
    process.env = { ...originalEnv };
    try {
      const previous = { ...process.env };
      await handleClientEnv(previous);
      vi.clearAllMocks();
      process.env.MASKED_PROBE = 'from-config';

      await handleClientEnv({ ...previous, MASKED_PROBE: 'from-config' });

      expect(invalidateGraphCache).toHaveBeenCalled();
    } finally {
      process.env = originalEnv;
    }
  });

  it('does nothing beyond applying the env when no keys changed', async () => {
    (applyDaemonEnvFromClient as Mock).mockReturnValue([]);

    await handleClientEnv(env);

    expect(applyDaemonEnvFromClient).toHaveBeenCalledWith(env);
    expect(getPluginsIfLoadedOrLoading).not.toHaveBeenCalled();
    expect(invalidateGraphCache).not.toHaveBeenCalled();
  });

  it('awaits worker forwarding before discarding the cached graph', async () => {
    let resolveForward: () => void = () => {};
    const setWorkerEnv = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        resolveForward = resolve;
      })
    );
    (getPluginsIfLoadedOrLoading as Mock).mockReturnValue(
      Promise.resolve([{ name: 'a', setWorkerEnv }])
    );

    const done = handleClientEnv(env);
    await flushMicrotasks();
    expect(setWorkerEnv).toHaveBeenCalledWith(env);
    expect(invalidateGraphCache).not.toHaveBeenCalled();

    resolveForward();
    await done;
    expect(invalidateGraphCache).toHaveBeenCalled();
  });

  it('holds a no-change client until the in-flight apply completes', async () => {
    let resolveForward: () => void = () => {};
    const setWorkerEnv = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        resolveForward = resolve;
      })
    );
    (getPluginsIfLoadedOrLoading as Mock).mockReturnValue(
      Promise.resolve([{ name: 'a', setWorkerEnv }])
    );

    const first = handleClientEnv(env);
    // The second client carries the same env the first already wrote to
    // process.env, so its own apply reports no changed keys.
    (applyDaemonEnvFromClient as Mock).mockReturnValue([]);
    let secondSettled = false;
    const second = handleClientEnv(env).then(() => {
      secondSettled = true;
    });

    await flushMicrotasks();
    expect(secondSettled).toBe(false);
    expect(invalidateGraphCache).not.toHaveBeenCalled();

    resolveForward();
    await first;
    await second;
    expect(secondSettled).toBe(true);
    expect(invalidateGraphCache).toHaveBeenCalled();
  });

  it('proceeds after the forward timeout when a worker never acknowledges', async () => {
    _setEnvForwardTimeoutMs(50);
    try {
      const setWorkerEnv = vi.fn().mockReturnValue(new Promise(() => {}));
      (getPluginsIfLoadedOrLoading as Mock).mockReturnValue(
        Promise.resolve([{ name: 'wedged', setWorkerEnv }])
      );

      await handleClientEnv(env);

      expect(invalidateGraphCache).toHaveBeenCalled();
      expect(serverLogger.log).toHaveBeenCalledWith(
        expect.stringContaining(
          'Timed out forwarding the new env to plugin workers'
        )
      );
    } finally {
      _setEnvForwardTimeoutMs(10_000);
    }
  });

  it('settles when a worker fails to receive the env', async () => {
    (getPluginsIfLoadedOrLoading as Mock).mockReturnValue(
      Promise.resolve([
        {
          name: 'dead',
          setWorkerEnv: vi.fn().mockRejectedValue(new Error('worker exited')),
        },
        { name: 'alive', setWorkerEnv: vi.fn().mockResolvedValue(undefined) },
      ])
    );

    await handleClientEnv(env);

    expect(serverLogger.log).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to forward env to plugin worker "dead": worker exited'
      )
    );
    expect(invalidateGraphCache).toHaveBeenCalled();
  });

  it('discards the cached graph even when no plugins are loaded', async () => {
    await handleClientEnv(env);

    expect(invalidateGraphCache).toHaveBeenCalled();
  });

  it('settles when an in-flight plugin load fails', async () => {
    (getPluginsIfLoadedOrLoading as Mock).mockReturnValue(
      Promise.reject(new Error('load failed'))
    );

    await expect(handleClientEnv(env)).resolves.toBeUndefined();
    expect(invalidateGraphCache).toHaveBeenCalled();
  });

  it('skips plugins without a worker to forward to', async () => {
    (getPluginsIfLoadedOrLoading as Mock).mockReturnValue(
      Promise.resolve([{ name: 'in-process' }])
    );

    await expect(handleClientEnv(env)).resolves.toBeUndefined();
    expect(invalidateGraphCache).toHaveBeenCalled();
  });

  describe.skipIf(process.platform === 'win32')(
    "a Yarn Berry client's bin folders",
    () => {
      const originalEnv = process.env;
      let root: string;
      let folder: string;
      let yarnEnv: Record<string, string>;
      let setWorkerEnv: Mock;

      beforeEach(async () => {
        const actual = await vi.importActual<
          typeof import('../client/daemon-environment')
        >('../client/daemon-environment');
        (applyDaemonEnvFromClient as Mock).mockImplementation(
          actual.applyDaemonEnvFromClient
        );
        (getAppliedDaemonClientEnv as Mock).mockImplementation(
          actual.getAppliedDaemonClientEnv
        );
        setWorkerEnv = vi.fn().mockResolvedValue(undefined);
        (getPluginsIfLoadedOrLoading as Mock).mockReturnValue(
          Promise.resolve([{ name: 'a', setWorkerEnv }])
        );
        process.env = { PATH: '/usr/bin' };
        root = mkdtempSync(join(tmpdir(), 'nx-berry-'));
        folder = join(root, 'xfs-1a2b3c4d');
        mkdirSync(folder, { mode: 0o755 });
        yarnEnv = {
          BERRY_BIN_FOLDER: folder,
          PATH: [folder, '/usr/bin'].join(delimiter),
        };
      });

      afterEach(() => {
        process.env = originalEnv;
        rmSync(root, { recursive: true, force: true });
      });

      it('keeps them off the daemon PATH and hands them to workers', async () => {
        const client = new EventEmitter();

        await handleClientEnv(yarnEnv, client);

        expect(process.env.PATH).toEqual('/usr/bin');
        expect(process.env.BERRY_BIN_FOLDER).toEqual(folder);
        expect(setWorkerEnv).toHaveBeenCalledWith(yarnEnv);
        expect(getLiveClientBerryEnv()).toEqual(yarnEnv);
      });

      it('withholds them from workers once they no longer exist', async () => {
        rmSync(folder, { recursive: true });

        await handleClientEnv(yarnEnv, new EventEmitter());

        expect(setWorkerEnv).toHaveBeenCalledWith({ PATH: '/usr/bin' });
      });

      it('takes them back from workers once the client disconnects', async () => {
        const client = new EventEmitter();
        await handleClientEnv(yarnEnv, client);
        setWorkerEnv.mockClear();

        client.emit('close');
        await flushMicrotasks();

        expect(setWorkerEnv).toHaveBeenCalledWith({ PATH: '/usr/bin' });
        expect(getLiveClientBerryEnv()).toEqual({});
      });

      it("leaves a newer client's folders alone when an older client disconnects", async () => {
        const older = new EventEmitter();
        await handleClientEnv(yarnEnv, older);
        const newerFolder = join(root, 'xfs-0000000b');
        mkdirSync(newerFolder, { mode: 0o755 });
        const newerEnv = {
          BERRY_BIN_FOLDER: newerFolder,
          PATH: [newerFolder, '/usr/bin'].join(delimiter),
        };
        await handleClientEnv(newerEnv, new EventEmitter());
        setWorkerEnv.mockClear();

        older.emit('close');
        await flushMicrotasks();

        expect(setWorkerEnv).not.toHaveBeenCalled();
        expect(getLiveClientBerryEnv()).toEqual(newerEnv);
      });

      it("leaves a newer client's folders alone when it applies while an older client's disconnect waits", async () => {
        let releaseFirstForward: () => void;
        setWorkerEnv.mockImplementationOnce(
          () => new Promise<void>((r) => (releaseFirstForward = r))
        );
        const older = new EventEmitter();
        const olderApply = handleClientEnv(yarnEnv, older);
        await flushMicrotasks();
        const newerFolder = join(root, 'xfs-0000000b');
        mkdirSync(newerFolder, { mode: 0o755 });
        const newerEnv = {
          BERRY_BIN_FOLDER: newerFolder,
          PATH: [newerFolder, '/usr/bin'].join(delimiter),
        };
        const newerApply = handleClientEnv(newerEnv, new EventEmitter());
        older.emit('close');
        releaseFirstForward();
        await Promise.all([olderApply, newerApply]);
        await flushMicrotasks();

        expect(setWorkerEnv).toHaveBeenLastCalledWith(newerEnv);
        expect(getLiveClientBerryEnv()).toEqual(newerEnv);
      });
    }
  );
});
