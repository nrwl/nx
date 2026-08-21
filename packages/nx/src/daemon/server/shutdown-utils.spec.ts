import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { dirSync } from 'tmp';

jest.mock('../logger', () => ({
  serverLogger: {
    log: jest.fn(),
    watcherLog: jest.fn(),
    requestLog: jest.fn(),
  },
}));
jest.mock('../cache', () => ({ deleteDaemonJsonProcessCache: jest.fn() }));
jest.mock('../../project-graph/plugins/get-plugins', () => ({
  cleanupPlugins: jest.fn(),
}));
jest.mock('../../analytics', () => ({ flushAnalytics: jest.fn() }));
jest.mock('../tmp-dir', () => ({
  DAEMON_DIR_FOR_CURRENT_WORKSPACE: '/tmp/nx-daemon-spec',
  DAEMON_OUTPUT_LOG_FILE: '/tmp/nx-daemon-spec/daemon.log',
}));
jest.mock('../../utils/provenance', () => ({
  ensurePackageHasProvenance: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../utils/package-manager', () => ({
  detectPackageManager: jest.fn().mockReturnValue('npm'),
}));
jest.mock('../../utils/package-json', () => ({
  installPackageToTmpAsync: jest.fn(),
}));

/**
 * Builds a directory shaped like a real `nx@latest` temp install: enough files
 * that removing it takes many syscalls, so an un-awaited or interrupted `rm`
 * cannot finish before `process.exit` runs.
 */
function createFakeInstallDir(): string {
  const dir = dirSync().name;
  for (let pkg = 0; pkg < 40; pkg++) {
    const nested = join(dir, 'node_modules', `pkg-${pkg}`, 'dist');
    mkdirSync(nested, { recursive: true });
    for (let file = 0; file < 40; file++) {
      writeFileSync(join(nested, `file-${file}.js`), 'x'.repeat(1024));
    }
  }
  return dir;
}

describe('shutdown-utils', () => {
  let handleServerProcessTermination: typeof import('./shutdown-utils').handleServerProcessTermination;
  let respondWithErrorAndExit: typeof import('./shutdown-utils').respondWithErrorAndExit;
  let exitSpy: jest.SpyInstance;
  let tempDir: string;

  const server = { close: (cb: () => void) => cb() } as any;
  const socket = { write: (_: string, cb: () => void) => cb() } as any;

  beforeEach(() => {
    // Both shutdown-utils and latest-nx keep module-level state (the in-flight
    // shutdown, the cached install), so each test needs fresh copies.
    jest.resetModules();
    jest.clearAllMocks();

    tempDir = createFakeInstallDir();
    const { installPackageToTmpAsync } =
      require('../../utils/package-json') as {
        installPackageToTmpAsync: jest.Mock;
      };
    installPackageToTmpAsync.mockResolvedValue({
      tempDir,
      cleanup: async () => {
        await rm(tempDir, { recursive: true, force: true });
      },
    });

    jest.spyOn(console, 'error').mockImplementation(() => {});
    ({
      handleServerProcessTermination,
      respondWithErrorAndExit,
    } = require('./shutdown-utils'));
  });

  afterEach(async () => {
    exitSpy?.mockRestore();
    jest.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  /** Seeds the daemon's cached `nx@latest` install, as a live daemon would hold. */
  async function primeLatestNxInstall() {
    const { getLatestNxTmpPath } = require('./latest-nx');
    await expect(getLatestNxTmpPath()).resolves.toBe(tempDir);
    expect(existsSync(tempDir)).toBe(true);
  }

  /** Records whether the install still existed the first time the process tried to exit. */
  function spyOnExit(): () => boolean | undefined {
    let existedAtFirstExit: boolean | undefined;
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(((): never => {
      existedAtFirstExit ??= existsSync(tempDir);
      return undefined as never;
    }) as never);
    return () => existedAtFirstExit;
  }

  it('finishes removing the latest Nx temp install before the process exits', async () => {
    await primeLatestNxInstall();
    const existedAtFirstExit = spyOnExit();

    await handleServerProcessTermination({
      server,
      reason: 'received process SIGTERM',
      sockets: [],
    });

    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(existedAtFirstExit()).toBe(false);
  });

  it('does not exit while a concurrent shutdown is still cleaning up', async () => {
    await primeLatestNxInstall();
    const existedAtFirstExit = spyOnExit();

    // `nx daemon --stop` raises SIGTERM and also trips the supersede check that
    // runs every 20ms, so two shutdowns land at essentially the same moment.
    await Promise.all([
      handleServerProcessTermination({
        server,
        reason: 'received process SIGTERM',
        sockets: [],
      }),
      handleServerProcessTermination({
        server,
        reason: 'this process is no longer the current daemon (native)',
        sockets: [],
      }),
    ]);

    expect(existedAtFirstExit()).toBe(false);
    expect(exitSpy).toHaveBeenCalledTimes(1);
  });

  it('removes the latest Nx temp install before exiting on a failed request', async () => {
    await primeLatestNxInstall();
    const existedAtFirstExit = spyOnExit();

    // This path exits without going through `performShutdown`, so it owns the
    // removal itself.
    await respondWithErrorAndExit(socket, 'a description', new Error('boom'));

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(existedAtFirstExit()).toBe(false);
  });

  it('keeps the latest Nx temp install on a project graph error, which does not exit', async () => {
    await primeLatestNxInstall();
    const existedAtFirstExit = spyOnExit();

    const {
      DaemonProjectGraphError,
    } = require('../../project-graph/error-types');
    await respondWithErrorAndExit(
      socket,
      'a description',
      new DaemonProjectGraphError([new Error('boom')], {} as any, {})
    );

    expect(exitSpy).not.toHaveBeenCalled();
    expect(existedAtFirstExit()).toBeUndefined();
    expect(existsSync(tempDir)).toBe(true);
  });
});
