import { dirSync } from 'tmp';

jest.mock('../logger', () => ({
  serverLogger: { log: jest.fn() },
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

describe('cleanupLatestNx', () => {
  let getLatestNxTmpPath: typeof import('./latest-nx').getLatestNxTmpPath;
  let cleanupLatestNx: typeof import('./latest-nx').cleanupLatestNx;
  let installPackageToTmpAsync: jest.Mock;

  beforeEach(() => {
    // latest-nx caches the install in module-level state, so each test needs a
    // fresh copy of the module - and of the mock it resolves against.
    jest.resetModules();
    jest.clearAllMocks();
    ({ installPackageToTmpAsync } = require('../../utils/package-json'));
    ({ getLatestNxTmpPath, cleanupLatestNx } = require('./latest-nx'));
  });

  function stubInstall(cleanup: () => Promise<void>) {
    installPackageToTmpAsync.mockResolvedValue({
      tempDir: '/tmp/fake-latest-nx',
      cleanup,
    });
  }

  it('resolves only once the installation has actually been removed', async () => {
    let removed = false;
    stubInstall(async () => {
      await new Promise((res) => setTimeout(res, 10));
      removed = true;
    });

    await getLatestNxTmpPath();
    await cleanupLatestNx();

    expect(removed).toBe(true);
  });

  it('is a no-op when nothing was installed', async () => {
    await expect(cleanupLatestNx()).resolves.toBeUndefined();
  });

  it('removes the installation only once', async () => {
    const cleanup = jest.fn().mockResolvedValue(undefined);
    stubInstall(cleanup);

    await getLatestNxTmpPath();
    await cleanupLatestNx();
    await cleanupLatestNx();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('makes a concurrent caller wait for the in-flight removal', async () => {
    let removed = false;
    stubInstall(async () => {
      await new Promise((res) => setTimeout(res, 10));
      removed = true;
    });

    await getLatestNxTmpPath();

    // `respondWithErrorAndExit` calls `process.exit` the moment its own cleanup
    // resolves, so a second caller resolving early kills the first one's `rm`.
    const first = cleanupLatestNx();
    await cleanupLatestNx();

    expect(removed).toBe(true);
    await first;
  });

  it('removes a re-installed copy that was pulled after an earlier cleanup', async () => {
    const cleanup = jest.fn().mockResolvedValue(undefined);
    stubInstall(cleanup);

    await getLatestNxTmpPath();
    await cleanupLatestNx();
    await getLatestNxTmpPath();
    await cleanupLatestNx();

    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it('reports an installation that is still on disk after a cleanup that resolved', async () => {
    const tempDir = dirSync().name;
    installPackageToTmpAsync.mockResolvedValue({
      tempDir,
      // `createTempNpmDirectory` swallows its own `rm` errors, so this is what a
      // failed removal looks like to the caller.
      cleanup: async () => {},
    });

    await getLatestNxTmpPath();
    await cleanupLatestNx();

    const { serverLogger } = require('../logger');
    expect(serverLogger.log).toHaveBeenCalledWith(
      expect.stringContaining('could not be removed'),
      tempDir
    );
  });

  it('swallows a failing cleanup so shutdown can still proceed', async () => {
    stubInstall(async () => {
      throw new Error('EBUSY');
    });

    await getLatestNxTmpPath();

    await expect(cleanupLatestNx()).resolves.toBeUndefined();
  });

  it('gives up on a cleanup that hangs rather than wedging shutdown', async () => {
    stubInstall(() => new Promise<void>(() => {}));

    await getLatestNxTmpPath();

    // Race a real timer so a broken timeout fails as an assertion rather than
    // hanging until jest's, which would skip the `useRealTimers` below.
    const realSetTimeout = setTimeout;
    jest.useFakeTimers();
    try {
      const pending = cleanupLatestNx();
      jest.advanceTimersByTime(10_000);
      await expect(
        Promise.race([
          pending.then(() => 'gave up'),
          new Promise((res) =>
            realSetTimeout(() => res('still hanging'), 1_000).unref()
          ),
        ])
      ).resolves.toBe('gave up');
    } finally {
      jest.useRealTimers();
    }
  });
});
