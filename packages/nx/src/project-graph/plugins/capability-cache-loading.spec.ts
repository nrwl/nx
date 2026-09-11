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
  readValidRecords: vi.fn(),
  recordCapabilities: vi.fn(),
  forgetCapabilities: vi.fn(),
  storableSourceFiles: vi.fn(),
  canObserveModuleClosure: vi.fn(() => true),
  warn: vi.fn(),
  lock: {
    tryLock: vi.fn(() => true),
    waitForRelease: vi.fn(() => Promise.resolve(true)),
    unlock: vi.fn(),
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
  computeCapabilityKey: (_moduleName: string, pluginPath: string) =>
    pluginPath.includes('unidentifiable') ? null : `key:${pluginPath}`,
  createCapabilitiesLock: () => mocks.lock,
  // Hashing and path handling have their own spec. Here the closures are
  // stand-ins that never touch disk, and one that cannot be stored or hashed is
  // deliberately not recorded, so both are stubbed.
  hashSourceFiles: () => 'source-hash',
  storableSourceFiles: (files: string[]) => mocks.storableSourceFiles(files),
  readValidRecords: mocks.readValidRecords,
  recordCapabilities: mocks.recordCapabilities,
  forgetCapabilities: mocks.forgetCapabilities,
}));

vi.mock('./isolation/module-closure', () => ({
  canObserveModuleClosure: () => mocks.canObserveModuleClosure(),
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

vi.mock('../../utils/output', () => ({
  output: { warn: mocks.warn },
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

    mocks.readValidRecords.mockReset();
    mocks.readValidRecords.mockImplementation((keys: string[]) => {
      const found = new Map<string, PluginCapabilities>();
      if (everythingRecorded) {
        for (const key of keys) {
          found.set(key, CAPABILITIES);
        }
      }
      return found;
    });
    mocks.recordCapabilities.mockReset();
    mocks.forgetCapabilities.mockReset();
    mocks.storableSourceFiles.mockReset();
    mocks.storableSourceFiles.mockImplementation((files: string[]) => files);
    mocks.canObserveModuleClosure.mockReset();
    mocks.canObserveModuleClosure.mockReturnValue(true);
    mocks.warn.mockReset();
    mocks.lock.tryLock.mockReset();
    mocks.lock.tryLock.mockReturnValue(true);
    mocks.lock.unlock.mockReset();
    mocks.lock.waitForRelease.mockReset();
    mocks.lock.waitForRelease.mockResolvedValue(true);

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
          sourceFiles: [`/resolved/${label}`],
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
    expect(recorded.record.capabilities).toEqual({
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
    mocks.lock.tryLock.mockReturnValue(false);
    mocks.lock.waitForRelease.mockImplementation(async () => {
      // The holder finishes while this process waits.
      everythingRecorded = true;
      return true;
    });

    await getPluginsSeparated({ plugins: ['test-plugin'] });

    expect(mocks.lock.waitForRelease).toHaveBeenCalled();
    expect(loadIsolatedNxPlugin).not.toHaveBeenCalled();
    // Never acquired, so nothing to release.
    expect(mocks.lock.unlock).not.toHaveBeenCalled();
  });

  it('reads the cache again once it holds the lock', async () => {
    // Acquired here, with the records arriving from the process that held it
    // immediately before.
    mocks.lock.tryLock.mockImplementation(() => {
      everythingRecorded = true;
      return true;
    });

    await getPluginsSeparated({ plugins: ['test-plugin'] });

    expect(loadIsolatedNxPlugin).not.toHaveBeenCalled();
    expect(mocks.lock.unlock).toHaveBeenCalledTimes(1);
  });

  it('loads anyway when whoever holds the lock never finishes', async () => {
    let now = Date.now();
    const dateNow = vi.spyOn(Date, 'now').mockImplementation(() => now);
    let waits = 0;
    try {
      // Held for the whole test, and every wait times out having seen nothing
      // recorded.
      mocks.lock.tryLock.mockReturnValue(false);
      mocks.lock.waitForRelease.mockImplementation(async (ms: number) => {
        // Fails loudly rather than spinning, so losing the budget shows up as
        // one named test instead of a killed worker.
        if (++waits > 4) {
          throw new Error(`waited ${waits} times: the budget is not bounding`);
        }
        expect(ms).toBeGreaterThan(0);
        expect(ms).toBeLessThanOrEqual(60_000);
        // The wait consumed the whole remaining budget.
        now += ms;
        return false;
      });

      await getPluginsSeparated({ plugins: ['test-plugin'] });

      expect(mocks.lock.waitForRelease).toHaveBeenCalled();
      expect(loadsOf('test-plugin')).toHaveLength(1);
      expect(mocks.lock.unlock).not.toHaveBeenCalled();
    } finally {
      dateNow.mockRestore();
    }
  });

  it('records each plugin against its own key', async () => {
    loadIsolatedNxPlugin.mockImplementation(async (plugin: unknown) => {
      const label =
        typeof plugin === 'string' ? plugin : (plugin as any).plugin;
      return [
        Promise.resolve({
          name: label,
          createNodes: [`**/${label}.config.ts`, async () => []],
          sourceFiles: [`/resolved/${label}`],
        }),
        () => {},
      ];
    });

    await getPluginsSeparated({ plugins: ['plugin-a', 'plugin-b'] });

    const recorded = new Map(
      mocks.recordCapabilities.mock.calls
        .flatMap(([entries]) => entries)
        .map((entry) => [entry.key, entry.record.capabilities])
    );
    // Pairing a key with another plugin's capabilities would poison the record
    // silently, so the two are checked against each other rather than counted.
    expect(recorded.get('key:/resolved/plugin-a').createNodesPattern).toBe(
      '**/plugin-a.config.ts'
    );
    expect(recorded.get('key:/resolved/plugin-b').createNodesPattern).toBe(
      '**/plugin-b.config.ts'
    );
  });

  it('records nothing for a plugin whose closure cannot be stored', async () => {
    // A closure reaching outside the workspace, which two checkouts sharing a
    // database could not validate against their own files.
    mocks.storableSourceFiles.mockReturnValue(null);

    await getPluginsSeparated({ plugins: ['test-plugin'] });

    expect(loadsOf('test-plugin')).toHaveLength(1);
    expect(mocks.recordCapabilities).toHaveBeenCalledWith([]);
  });

  describe('a record the key failed to invalidate', () => {
    async function loadedFromRecordThenReport(
      actual: PluginCapabilities,
      sourceFiles: string[] | null = ['/resolved/test-plugin']
    ) {
      everythingRecorded = true;
      await getPluginsSeparated({ plugins: ['test-plugin'] });

      const [, , , , , onLoaded] =
        useIsolatedNxPluginCapabilities.mock.calls.find(
          ([plugin]) => plugin === 'test-plugin'
        );
      mocks.recordCapabilities.mockClear();
      onLoaded(actual, sourceFiles);
    }

    it('is replaced by what the worker reported', async () => {
      await loadedFromRecordThenReport({
        ...CAPABILITIES,
        hasPostTasksExecution: true,
      });

      expect(mocks.recordCapabilities).toHaveBeenCalledWith([
        {
          key: 'key:/resolved/test-plugin',
          record: expect.objectContaining({
            capabilities: expect.objectContaining({
              hasPostTasksExecution: true,
            }),
          }),
        },
      ]);
      // The only moment anything can notice a record that drifted, so it is not
      // a verbose-only log.
      expect(mocks.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('test-plugin'),
        })
      );
    });

    it('is dropped, and the command fails, when no closure can be stored for it', async () => {
      await expect(
        loadedFromRecordThenReport(
          { ...CAPABILITIES, hasPostTasksExecution: true },
          null
        )
      ).rejects.toThrow('The stale record has been cleared');

      // An empty closure is the vendor-only case, which `recordIsFresh` accepts
      // without hashing anything. Writing one here would make a stale record
      // permanent on every runtime, so the record goes instead and the next run
      // loads the plugin.
      expect(mocks.recordCapabilities).not.toHaveBeenCalled();
      expect(mocks.forgetCapabilities).toHaveBeenCalledWith(
        'key:/resolved/test-plugin'
      );
    });

    it('says what a runtime that cannot observe a closure needs', async () => {
      mocks.canObserveModuleClosure.mockReturnValue(false);

      await expect(
        loadedFromRecordThenReport(
          { ...CAPABILITIES, hasPostTasksExecution: true },
          null
        )
        // The only thing the user can act on here is the Node version, since
        // every other process that writes a record needs the same floor.
      ).rejects.toThrow('Node 22.15');
    });

    it('is left alone when the worker agrees with it', async () => {
      await loadedFromRecordThenReport({ ...CAPABILITIES });

      expect(mocks.recordCapabilities).not.toHaveBeenCalled();
      expect(mocks.warn).not.toHaveBeenCalled();
    });
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

    // Every acquire is released, however many batches took the lock.
    const acquires = mocks.lock.tryLock.mock.results.filter(
      (result) => result.value === true
    ).length;
    expect(acquires).toBeGreaterThan(0);
    expect(mocks.lock.unlock).toHaveBeenCalledTimes(acquires);
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

    it('counts distinct modules, so two entries naming one module still answer', async () => {
      everythingRecorded = true;

      const peeked = await peekPluginCapabilities({
        plugins: ['test-plugin', { plugin: 'test-plugin', options: {} }],
      });

      // Both entries resolve to one module and therefore one key, so comparing
      // the records against the number of entries would decline here.
      expect(peeked).not.toBeNull();
      expect(peeked[0]).toEqual(CAPABILITIES);
      expect(peeked[1]).toEqual(CAPABILITIES);
    });

    it('declines when a plugin module cannot be identified', async () => {
      everythingRecorded = true;

      expect(
        await peekPluginCapabilities({ plugins: ['unidentifiable-plugin'] })
      ).toBeNull();
    });
  });
});
