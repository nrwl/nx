import {
  importUltracacheConfiguration,
  loadUltracacheConfigurationForRun,
  openUltracacheConfiguration,
} from './store';

const store = vi.hoisted(() => ({
  import: vi.fn(),
  get: vi.fn(),
  getVersion: vi.fn(),
}));
const cloud = vi.hoisted(() => ({ fetchUltracacheConfiguration: vi.fn() }));

const UltracacheConfigurationStore = vi.hoisted(() =>
  vi.fn(function () {
    return store;
  })
);
const lock = vi.hoisted(() => ({
  tryLock: vi.fn(() => true),
  wait: vi.fn(async () => {}),
  unlock: vi.fn(),
}));
vi.mock('../native', () => ({
  UltracacheConfigurationStore,
  IS_WASM: false,
  FileLock: vi.fn(function () {
    return lock;
  }),
}));
vi.mock('./fetch', () => ({
  fetchUltracacheConfiguration: cloud.fetchUltracacheConfiguration,
}));
vi.mock('../utils/git-utils', () => ({ getLatestCommitSha: () => 'head' }));
vi.mock('../utils/db-connection', () => ({
  getDbConnection: () => 'db',
  sharedWorkspaceDataDirectory: () => '/workspace-data',
}));
vi.mock('../utils/nx-cloud-utils', () => ({
  isNxCloudConfigured: () => true,
}));
const warn = vi.hoisted(() => vi.fn());
vi.mock('../utils/output', () => ({ output: { warn } }));
vi.mock('../utils/logger', () => ({ logger: { verbose: vi.fn() } }));

describe('loadUltracacheConfigurationForRun', () => {
  afterEach(() => vi.unstubAllEnvs());

  const nxJson = {} as any;
  /** A run that opted in, stated explicitly so the machine's env cannot. */
  const optedIn = (overrides: Record<string, unknown> = {}) => ({
    NX_CLOUD_USE_ULTRACACHE: 'true',
    ...overrides,
  });
  /** A stored set for HEAD. */
  const stored = () => ({
    commit: 'head',
    resolution: {
      fetchedAt: 0,
      requestedCommit: 'head',
      tasks: 1,
    },
  });
  const coded = (code: string, message = code) =>
    Object.assign(new Error(message), { code });

  beforeEach(() => {
    vi.stubEnv('CI', 'true');
    vi.clearAllMocks();
    store.get.mockReset();
    store.import.mockReset();
    store.get.mockReturnValue(null);
    cloud.fetchUltracacheConfiguration.mockResolvedValue({
      snapshots: {},
    });
  });

  // Connecting the workspace is not the opt-in: a run that says nothing
  // never reaches Nx Cloud.
  it('does nothing for a run that did not opt in', async () => {
    for (const NX_CLOUD_USE_ULTRACACHE of [undefined, 'false']) {
      expect(
        await loadUltracacheConfigurationForRun(
          nxJson,
          {},
          optedIn({ NX_CLOUD_USE_ULTRACACHE })
        )
      ).toBeNull();
    }
    expect(cloud.fetchUltracacheConfiguration).not.toHaveBeenCalled();
  });

  it('serves a stored set under an hour old without asking Nx Cloud', async () => {
    const set = stored();
    store.get.mockReturnValue(set);
    expect(
      await loadUltracacheConfigurationForRun(nxJson, {}, optedIn())
    ).toEqual({
      status: 'cached',
      configuration: set,
    });
    expect(store.get).toHaveBeenCalledWith('head', 60 * 60 * 1000);
    expect(cloud.fetchUltracacheConfiguration).not.toHaveBeenCalled();
  });

  it('imports what Nx Cloud read when no stored set is young enough', async () => {
    const configuration = {
      'web:build': { commit: 'parent', inputs: ['apps/web/**'], outputs: [] },
    };
    cloud.fetchUltracacheConfiguration.mockResolvedValue({
      snapshots: configuration,
    });
    const set = stored();
    store.import.mockReturnValue(set);
    const result = await loadUltracacheConfigurationForRun(
      nxJson,
      { accessToken: 't' },
      optedIn()
    );
    expect(cloud.fetchUltracacheConfiguration).toHaveBeenCalledWith({
      accessToken: 't',
    });
    expect(store.import).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedCommit: 'head',
        configurationJson: JSON.stringify(configuration),
      })
    );
    expect(result).toEqual({ status: 'fetched', configuration: set });
  });

  it('fetches once under the lock, and uses a set another process stored meanwhile', async () => {
    lock.wait.mockClear();
    lock.unlock.mockClear();
    const set = stored();
    lock.tryLock.mockReturnValueOnce(false);
    // Missed before the lock; the holder stored one before releasing it.
    store.get.mockReturnValueOnce(null).mockReturnValueOnce(set);

    const outcome = await loadUltracacheConfigurationForRun(
      nxJson,
      {},
      optedIn()
    );

    expect(outcome).toEqual({ status: 'cached', configuration: set });
    expect(lock.wait).toHaveBeenCalledTimes(1);
    expect(lock.unlock).toHaveBeenCalledTimes(1);
    expect(cloud.fetchUltracacheConfiguration).not.toHaveBeenCalled();
  });

  it('hashes natively when the read fails, with the reason its code gives', async () => {
    for (const [code, reason] of [
      ['ENOTFOUND', 'offline'],
      ['UNAUTHORIZED', 'unauthorized'],
      ['UNSUPPORTED_CLIENT', 'unsupported-client'],
      ['NO_CLOUD_CLIENT', 'no-cloud-client'],
    ]) {
      cloud.fetchUltracacheConfiguration.mockRejectedValueOnce(
        coded(code, 'x')
      );
      expect(
        await loadUltracacheConfigurationForRun(nxJson, {}, optedIn())
      ).toEqual({
        status: 'skipped',
        reason,
        message: 'x',
      });
    }
    cloud.fetchUltracacheConfiguration.mockRejectedValueOnce(
      new Error('no code')
    );
    expect(
      await loadUltracacheConfigurationForRun(nxJson, {}, optedIn())
    ).toMatchObject({
      reason: 'fetch-failed',
    });
  });

  it('hashes natively instead of reusing a stale set when the refresh fails', async () => {
    // As the native store behaves: the old set is there, but not young enough.
    store.get.mockImplementation((_commit, maxAgeMs) =>
      maxAgeMs === undefined ? stored() : null
    );
    cloud.fetchUltracacheConfiguration.mockRejectedValueOnce(
      coded('ENOTFOUND', 'x')
    );
    expect(
      await loadUltracacheConfigurationForRun(nxJson, {}, optedIn())
    ).toEqual({
      status: 'skipped',
      reason: 'offline',
      message: 'x',
    });
    // Checked before and under the lock, never without the age limit.
    expect(store.get.mock.calls).toEqual([
      ['head', 60 * 60 * 1000],
      ['head', 60 * 60 * 1000],
    ]);
  });

  // Only reasons that point at misconfiguration warn on every run.
  it('warns for an unauthorized read but not when Nx Cloud has no set', async () => {
    cloud.fetchUltracacheConfiguration.mockRejectedValueOnce(
      coded('NO_SNAPSHOTS')
    );
    expect(
      await loadUltracacheConfigurationForRun(nxJson, {}, optedIn())
    ).toMatchObject({
      reason: 'no-snapshots',
    });
    expect(warn).not.toHaveBeenCalled();

    cloud.fetchUltracacheConfiguration.mockRejectedValueOnce(
      coded('UNAUTHORIZED')
    );
    await loadUltracacheConfigurationForRun(nxJson, {}, optedIn());
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('skips rather than throws when the store cannot be opened', async () => {
    UltracacheConfigurationStore.mockImplementationOnce(function () {
      throw new Error('database disk image is malformed');
    });
    expect(
      await loadUltracacheConfigurationForRun(nxJson, {}, optedIn())
    ).toMatchObject({
      status: 'skipped',
      message: 'database disk image is malformed',
    });
    expect(cloud.fetchUltracacheConfiguration).not.toHaveBeenCalled();
  });

  it('skips when the store cannot write what Nx Cloud read', async () => {
    store.import.mockImplementation(() => {
      throw coded('WRITE_FAILED', 'disk full');
    });
    expect(
      await loadUltracacheConfigurationForRun(nxJson, {}, optedIn())
    ).toMatchObject({
      status: 'skipped',
      reason: 'write-failed',
    });
  });
});

describe('importUltracacheConfiguration', () => {
  it('stores what the Nx Cloud client read and returns the handle', () => {
    const handle = { commit: 'head' };
    store.import.mockReturnValue(handle);
    const configuration = {
      'web:build': { commit: 'head', inputs: ['apps/web/**'], outputs: [] },
    };
    expect(importUltracacheConfiguration('head', configuration)).toBe(handle);
    expect(store.import).toHaveBeenCalledWith({
      requestedCommit: 'head',
      configurationJson: JSON.stringify(configuration),
    });
  });
});

describe('openUltracacheConfiguration', () => {
  it('reopens the stored version by commit and fetch time', () => {
    const handle = { commit: 'head' };
    store.getVersion.mockReturnValue(handle);
    expect(openUltracacheConfiguration('head', 7)).toBe(handle);
    expect(store.getVersion).toHaveBeenCalledWith('head', 7);

    store.getVersion.mockReturnValue(null);
    expect(openUltracacheConfiguration('head', 8)).toBeNull();
  });
});
