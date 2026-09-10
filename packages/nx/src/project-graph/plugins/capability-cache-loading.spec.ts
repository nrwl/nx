import type { Mock } from 'vitest';

import type { PluginCapabilities } from './capabilities-cache';

const CAPABILITIES: PluginCapabilities = {
  name: 'test-plugin',
  createNodesPattern: '**/*.config.ts',
  hasCreateDependencies: true,
  hasCreateMetadata: false,
  hasPreTasksExecution: false,
  hasPostTasksExecution: false,
};

const mocks = vi.hoisted(() => ({
  readCachedCapabilities: vi.fn(),
  recordCapabilities: vi.fn(),
  lock: {
    check: vi.fn(() => false),
    lock: vi.fn(),
    unlock: vi.fn(),
    wait: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('./isolation/enabled', () => ({
  isIsolationEnabled: () => true,
}));

vi.mock('./isolation', () => ({
  loadIsolatedNxPlugin: vi.fn(),
  useIsolatedNxPluginCapabilities: vi.fn(),
}));

vi.mock('./isolation/isolated-plugin', () => ({
  isPluginWorkerSocketRefusal: () => false,
  isPluginWorkerStartupFailure: () => false,
  resolveModule: vi.fn(async (plugin: unknown) => {
    const label = typeof plugin === 'string' ? plugin : (plugin as any).plugin;
    return {
      name: label,
      pluginPath: `/resolved/${label}`,
      shouldRegisterTSTranspiler: false,
    };
  }),
}));

vi.mock('./capabilities-cache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./capabilities-cache')>()),
  isCapabilityCacheEnabled: () => true,
  computeCapabilityKey: async (pluginPath: string) =>
    pluginPath.includes('unidentifiable') ? null : `key:${pluginPath}`,
  createCapabilitiesLock: () => mocks.lock,
  readCachedCapabilities: mocks.readCachedCapabilities,
  recordCapabilities: mocks.recordCapabilities,
}));

vi.mock('../../adapter/angular-json', () => ({
  shouldMergeAngularProjects: () => false,
}));

vi.mock('./resolve-plugin', () => ({
  resetResolvePluginCache: vi.fn(),
}));

vi.mock('./transpiler', () => ({
  pluginTranspilerIsRegistered: () => false,
  cleanupPluginTSTranspiler: vi.fn(),
}));

vi.mock('../../utils/delayed-spinner', () => ({
  DelayedSpinner: class {
    cleanup() {}
  },
}));

describe('loading plugins through the capability cache', () => {
  let getPluginsSeparated: typeof import('./get-plugins').getPluginsSeparated;
  let peekPluginCapabilities: typeof import('./get-plugins').peekPluginCapabilities;
  let loadIsolatedNxPlugin: Mock;
  let useIsolatedNxPluginCapabilities: Mock;
  /** Whether every key asked for has a record, as a warm cache would. */
  let everythingRecorded: boolean;

  beforeEach(async () => {
    vi.resetModules();
    everythingRecorded = false;

    mocks.readCachedCapabilities.mockReset();
    mocks.readCachedCapabilities.mockImplementation((keys: string[]) => {
      const found = new Map<string, PluginCapabilities>();
      if (everythingRecorded) {
        for (const key of keys) {
          found.set(key, CAPABILITIES);
        }
      }
      return found;
    });
    mocks.recordCapabilities.mockReset();
    mocks.lock.check.mockReset();
    mocks.lock.check.mockReturnValue(false);
    mocks.lock.lock.mockReset();
    mocks.lock.unlock.mockReset();
    mocks.lock.wait.mockReset();
    mocks.lock.wait.mockResolvedValue(undefined);

    ({ loadIsolatedNxPlugin, useIsolatedNxPluginCapabilities } =
      (await import('./isolation')) as any);
    loadIsolatedNxPlugin.mockReset();
    loadIsolatedNxPlugin.mockImplementation(async (plugin: unknown) => {
      const label =
        typeof plugin === 'string' ? plugin : (plugin as any).plugin;
      return [
        Promise.resolve({
          name: label,
          createNodes: ['**/*.config.ts', async () => []],
          createDependencies: async () => [],
        }),
        () => {},
      ];
    });
    useIsolatedNxPluginCapabilities.mockReset();
    useIsolatedNxPluginCapabilities.mockImplementation(
      (plugin: unknown, _root, _resolved, capabilities) => [
        Promise.resolve({
          name: typeof plugin === 'string' ? plugin : (plugin as any).plugin,
          createNodes: capabilities.createNodesPattern
            ? [capabilities.createNodesPattern, async () => []]
            : undefined,
        }),
        () => {},
      ]
    );

    ({ getPluginsSeparated, peekPluginCapabilities } =
      await import('./get-plugins'));
  });

  function loadsOf(pluginName: string) {
    return loadIsolatedNxPlugin.mock.calls.filter(
      ([plugin]) => plugin === pluginName
    );
  }

  it('records what a plugin registers the first time any process loads it', async () => {
    await getPluginsSeparated({ plugins: ['test-plugin'] });

    expect(loadsOf('test-plugin')).toHaveLength(1);
    expect(mocks.recordCapabilities).toHaveBeenCalled();
    const recorded = mocks.recordCapabilities.mock.calls
      .flatMap(([entries]) => entries)
      .find((entry) => entry.key === 'key:/resolved/test-plugin');
    expect(recorded.capabilities).toEqual({
      name: 'test-plugin',
      createNodesPattern: '**/*.config.ts',
      hasCreateDependencies: true,
      hasCreateMetadata: false,
      hasPreTasksExecution: false,
      hasPostTasksExecution: false,
    });
  });

  it('wires a recorded plugin without starting a worker', async () => {
    everythingRecorded = true;

    const { specifiedPlugins } = await getPluginsSeparated({
      plugins: ['test-plugin'],
    });

    expect(loadIsolatedNxPlugin).not.toHaveBeenCalled();
    expect(useIsolatedNxPluginCapabilities).toHaveBeenCalledWith(
      'test-plugin',
      expect.any(String),
      expect.objectContaining({ pluginPath: '/resolved/test-plugin' }),
      CAPABILITIES,
      0,
      expect.any(Function)
    );
    expect(specifiedPlugins[0].createNodes[0]).toBe('**/*.config.ts');
    expect(mocks.recordCapabilities).not.toHaveBeenCalled();
  });

  it('waits for the process that is already loading rather than loading too', async () => {
    mocks.lock.check.mockReturnValue(true);
    mocks.lock.wait.mockImplementation(async () => {
      // The holder finishes while this process waits.
      everythingRecorded = true;
      mocks.lock.check.mockReturnValue(false);
    });

    await getPluginsSeparated({ plugins: ['test-plugin'] });

    expect(mocks.lock.wait).toHaveBeenCalled();
    expect(mocks.lock.lock).not.toHaveBeenCalled();
    expect(loadIsolatedNxPlugin).not.toHaveBeenCalled();
  });

  it('reads the cache again after taking the lock, since two processes can both find it free', async () => {
    // `check` and `lock` are separate calls. This process found the lock free,
    // then blocked in `lock` behind a holder that recorded everything.
    mocks.lock.lock.mockImplementation(() => {
      everythingRecorded = true;
    });

    await getPluginsSeparated({ plugins: ['test-plugin'] });

    expect(mocks.lock.lock).toHaveBeenCalled();
    expect(loadIsolatedNxPlugin).not.toHaveBeenCalled();
    expect(mocks.lock.unlock).toHaveBeenCalledTimes(1);
  });

  it('loads anyway when whoever holds the lock never finishes', async () => {
    const start = Date.now();
    let now = start;
    const dateNow = vi.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      // Held for the whole test, and each wait returns having recorded nothing.
      mocks.lock.check.mockReturnValue(true);
      mocks.lock.wait.mockImplementation(async () => {
        now += 61_000;
      });

      await getPluginsSeparated({ plugins: ['test-plugin'] });

      // Reaching these assertions at all is the point: an unbounded wait
      // against a lock that is never released would spin here forever.
      expect(mocks.lock.wait).toHaveBeenCalled();
      expect(mocks.lock.lock).not.toHaveBeenCalled();
      expect(loadsOf('test-plugin')).toHaveLength(1);
    } finally {
      dateNow.mockRestore();
    }
  });

  it('releases the lock when a plugin fails to load', async () => {
    loadIsolatedNxPlugin.mockImplementation(async (plugin: unknown) => {
      if (plugin === 'test-plugin') {
        throw new Error('boom');
      }
      return [Promise.resolve({ name: String(plugin) }), () => {}];
    });

    await expect(
      getPluginsSeparated({ plugins: ['test-plugin'] })
    ).rejects.toThrow('boom');

    expect(mocks.lock.lock).toHaveBeenCalled();
    expect(mocks.lock.unlock).toHaveBeenCalledTimes(
      mocks.lock.lock.mock.calls.length
    );
    // A plugin that did not load has nothing to record.
    const recorded = mocks.recordCapabilities.mock.calls
      .flatMap(([entries]) => entries)
      .map((entry) => entry.key);
    expect(recorded).not.toContain('key:/resolved/test-plugin');
  });
  describe('peeking at the records', () => {
    it('answers for every configured plugin, including the defaults', async () => {
      everythingRecorded = true;

      const peeked = await peekPluginCapabilities({ plugins: ['test-plugin'] });

      // One from nx.json plus the default plugins, which contribute the
      // package.json and project.json patterns an answer has to include.
      expect(peeked.length).toBeGreaterThan(1);
      expect(peeked[0]).toEqual(CAPABILITIES);
      expect(loadIsolatedNxPlugin).not.toHaveBeenCalled();
      expect(useIsolatedNxPluginCapabilities).not.toHaveBeenCalled();
    });

    it('declines when any plugin has no record', async () => {
      expect(
        await peekPluginCapabilities({ plugins: ['test-plugin'] })
      ).toBeNull();
    });

    it('declines when a plugin module cannot be identified', async () => {
      everythingRecorded = true;

      expect(
        await peekPluginCapabilities({ plugins: ['unidentifiable-plugin'] })
      ).toBeNull();
    });
  });
});
