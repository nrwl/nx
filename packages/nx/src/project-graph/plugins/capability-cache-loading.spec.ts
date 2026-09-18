import type { EnvReads } from './isolation/env-reads';

/** A load that read nothing, which is most of them. */
const NO_ENV_READS: EnvReads = { keys: [], hash: 'nothing-read' };
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
  loadForCapabilities: vi.fn(),
  readValidRecords: vi.fn(),
  recordCapabilities: vi.fn(),
  forgetCapabilities: vi.fn(),
  storableSourceFiles: vi.fn(),
  canObserveModuleClosure: vi.fn(() => true),
  warn: vi.fn(),
  lock: {
    tryLock: vi.fn(() => true),
    waitUntilFree: vi.fn((_timeoutMs: number) => Promise.resolve()),
    unlock: vi.fn(),
  },
}));

vi.mock('./isolation/enabled', () => ({
  isIsolationEnabled: () => true,
}));

vi.mock('./isolation', () => ({
  loadIsolatedNxPlugin: vi.fn(),
  useIsolatedNxPluginCapabilities: vi.fn(),
  disposeIsolatedPlugins: vi.fn(),
  wantPlugins: vi.fn(),
}));

vi.mock('./isolation/isolated-plugin', () => ({
  isPluginWorkerSocketRefusal: () => false,
  isPluginWorkerStartupFailure: () => false,
  IsolatedPlugin: { load: mocks.loadForCapabilities },
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
  // Keyed on what nx.json names, as the real one is.
  computeCapabilityKey: (moduleName: string) =>
    moduleName.includes('unidentifiable') ? null : `key:${moduleName}`,
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
  let capabilitiesOfConfiguredPlugins: typeof import('./get-plugins').capabilitiesOfConfiguredPlugins;
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
    mocks.loadForCapabilities.mockReset();
    mocks.loadForCapabilities.mockImplementation(async (plugin: unknown) => {
      const label =
        typeof plugin === 'string' ? plugin : (plugin as any).plugin;
      return {
        name: label,
        createNodes: ['**/*.config.ts', async () => []],
        createDependencies: async () => [],
        sourceFiles: [`/resolved/${label}`],
        envReads: NO_ENV_READS,
        dispose: vi.fn(),
      };
    });
    mocks.forgetCapabilities.mockReset();
    mocks.storableSourceFiles.mockReset();
    mocks.storableSourceFiles.mockImplementation((files: string[]) => files);
    mocks.canObserveModuleClosure.mockReset();
    mocks.canObserveModuleClosure.mockReturnValue(true);
    mocks.warn.mockReset();
    mocks.lock.tryLock.mockReset();
    mocks.lock.tryLock.mockReturnValue(true);
    mocks.lock.unlock.mockReset();
    mocks.lock.waitUntilFree.mockReset();
    mocks.lock.waitUntilFree.mockResolvedValue(undefined);

    ({ loadIsolatedNxPlugin, useIsolatedNxPluginCapabilities } =
      (await import('./isolation')) as any);
    loadIsolatedNxPlugin.mockReset();
    loadIsolatedNxPlugin.mockImplementation(async (plugin: unknown) => {
      const label =
        typeof plugin === 'string' ? plugin : (plugin as any).plugin;
      return {
        name: label,
        createNodes: ['**/*.config.ts', async () => []],
        createDependencies: async () => [],
        sourceFiles: [`/resolved/${label}`],
        envReads: NO_ENV_READS,
      };
    });
    useIsolatedNxPluginCapabilities.mockReset();
    useIsolatedNxPluginCapabilities.mockImplementation(
      (plugin: unknown, _root, _resolved, capabilities) =>
        Promise.resolve({
          name: typeof plugin === 'string' ? plugin : (plugin as any).plugin,
          createNodes: capabilities.createNodesPattern
            ? [capabilities.createNodesPattern, async () => []]
            : undefined,
        })
    );

    ({
      getPluginsSeparated,
      peekPluginCapabilities,
      capabilitiesOfConfiguredPlugins,
    } = await import('./get-plugins'));
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
      .find((entry) => entry.key === 'key:test-plugin');
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
    mocks.lock.waitUntilFree.mockImplementation(async () => {
      // The holder finishes while this process waits.
      everythingRecorded = true;
    });

    await getPluginsSeparated({ plugins: ['test-plugin'] });

    expect(mocks.lock.waitUntilFree).toHaveBeenCalled();
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
      mocks.lock.waitUntilFree.mockImplementation(async (ms: number) => {
        // Fails loudly rather than spinning, so losing the budget shows up as
        // one named test instead of a killed worker.
        if (++waits > 4) {
          throw new Error(`waited ${waits} times: the budget is not bounding`);
        }
        expect(ms).toBeGreaterThan(0);
        expect(ms).toBeLessThanOrEqual(60_000);
        // The wait consumed the whole remaining budget, then rejected as the
        // native one does.
        now += ms;
        throw Object.assign(new Error('timed out'), { code: 'Timeout' });
      });

      await getPluginsSeparated({ plugins: ['test-plugin'] });

      expect(mocks.lock.waitUntilFree).toHaveBeenCalled();
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
      return {
        name: label,
        createNodes: [`**/${label}.config.ts`, async () => []],
        sourceFiles: [`/resolved/${label}`],
        envReads: NO_ENV_READS,
      };
    });

    await getPluginsSeparated({ plugins: ['plugin-a', 'plugin-b'] });

    const recorded = new Map(
      mocks.recordCapabilities.mock.calls
        .flatMap(([entries]) => entries)
        .map((entry) => [entry.key, entry.record.capabilities])
    );
    // Pairing a key with another plugin's capabilities would poison the record
    // silently, so the two are checked against each other rather than counted.
    expect(recorded.get('key:plugin-a').createNodesPattern).toBe(
      '**/plugin-a.config.ts'
    );
    expect(recorded.get('key:plugin-b').createNodesPattern).toBe(
      '**/plugin-b.config.ts'
    );
  });

  it('records a plugin that simply has no hooks', async () => {
    loadIsolatedNxPlugin.mockImplementation(async (plugin: unknown) => ({
      name: typeof plugin === 'string' ? plugin : (plugin as any).plugin,
      sourceFiles: ['/resolved/test-plugin'],
      envReads: NO_ENV_READS,
    }));

    await getPluginsSeparated({ plugins: ['test-plugin'] });

    // The case worth caching most: there is no reason to ever load this again.
    expect(mocks.recordCapabilities).toHaveBeenCalledWith([
      expect.objectContaining({ key: 'key:test-plugin' }),
    ]);
  });

  it('records the variable a plugin read while deciding what to register', async () => {
    loadIsolatedNxPlugin.mockImplementation(async (plugin: unknown) => ({
      name: typeof plugin === 'string' ? plugin : (plugin as any).plugin,
      sourceFiles: ['/resolved/test-plugin'],
      envReads: { keys: ['NX_DOTNET_DISABLE'], hash: 'dotnet-disable-set' },
    }));

    await getPluginsSeparated({ plugins: ['test-plugin'] });

    // `@nx/dotnet` exports no hooks under `NX_DOTNET_DISABLE` and its files
    // are identical either way, so the variable on the record is the only
    // thing that invalidates it.
    expect(mocks.recordCapabilities).toHaveBeenCalledWith([
      expect.objectContaining({
        key: 'key:test-plugin',
        record: expect.objectContaining({
          envReads: JSON.stringify({
            keys: ['NX_DOTNET_DISABLE'],
            hash: 'dotnet-disable-set',
          }),
        }),
      }),
    ]);
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
      observed: {
        sourceFiles: string[] | null;
        envReads: EnvReads | null;
      } = { sourceFiles: ['/resolved/test-plugin'], envReads: NO_ENV_READS }
    ) {
      everythingRecorded = true;
      await getPluginsSeparated({ plugins: ['test-plugin'] });

      const [, , , , , onLoaded] =
        useIsolatedNxPluginCapabilities.mock.calls.find(
          ([plugin]) => plugin === 'test-plugin'
        );
      mocks.recordCapabilities.mockClear();
      onLoaded(actual, observed);
    }

    it('is replaced by what the worker reported', async () => {
      await loadedFromRecordThenReport({
        ...CAPABILITIES,
        hasPostTasksExecution: true,
      });

      expect(mocks.recordCapabilities).toHaveBeenCalledWith([
        {
          key: 'key:test-plugin',
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
          { sourceFiles: null, envReads: NO_ENV_READS }
        )
      ).rejects.toThrow('The stale record has been cleared');

      // An empty closure is the vendor-only case, which `recordIsFresh` accepts
      // without hashing anything. Writing one here would make a stale record
      // permanent on every runtime, so the record goes instead and the next run
      // loads the plugin.
      expect(mocks.recordCapabilities).not.toHaveBeenCalled();
      expect(mocks.forgetCapabilities).toHaveBeenCalledWith('key:test-plugin');
    });

    it('is left alone when the worker agrees with it', async () => {
      await loadedFromRecordThenReport({ ...CAPABILITIES });

      expect(mocks.recordCapabilities).not.toHaveBeenCalled();
      expect(mocks.warn).not.toHaveBeenCalled();
    });

    it('is no longer what a later peek in the same command answers from', async () => {
      // The gates peek twice per command, before and after the tasks, and the
      // first answer is held. Keeping it past a repair would answer the second
      // gate from the record this one just proved wrong, so the hook it hid
      // would be skipped again in the very command that discovered it.
      await peekPluginCapabilities({ plugins: ['test-plugin'] });
      await loadedFromRecordThenReport({
        ...CAPABILITIES,
        hasPostTasksExecution: true,
      });

      // What the corrected record now says, which is what a second peek has to
      // go back and read.
      mocks.readValidRecords.mockImplementation((keys: string[]) => {
        const found = new Map<string, PluginCapabilities>();
        for (const key of keys) {
          found.set(key, { ...CAPABILITIES, hasPostTasksExecution: true });
        }
        return found;
      });
      const peeked = await peekPluginCapabilities({ plugins: ['test-plugin'] });

      expect(peeked[0].hasPostTasksExecution).toBe(true);
    });
  });

  it('releases the lock when a plugin fails to load', async () => {
    loadIsolatedNxPlugin.mockImplementation(async (plugin: unknown) => {
      if (plugin === 'test-plugin') {
        throw new Error('boom');
      }
      return { name: String(plugin) };
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
    expect(recorded).not.toContain('key:test-plugin');
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

    it('loads only the plugins with no record, and puts them back down', async () => {
      // A record for everything but the one nx.json names.
      mocks.readValidRecords.mockImplementation((keys: string[]) => {
        const found = new Map<string, PluginCapabilities>();
        for (const key of keys) {
          if (!key.includes('test-plugin')) {
            found.set(key, CAPABILITIES);
          }
        }
        return found;
      });

      const peeked = await peekPluginCapabilities({ plugins: ['test-plugin'] });

      // Complete, rather than null, which used to send the caller off to load
      // every plugin for the sake of the one that was missing.
      expect(peeked).not.toBeNull();
      expect(peeked[0].createNodesPattern).toBe('**/*.config.ts');

      const loaded = mocks.loadForCapabilities.mock.calls.map(([plugin]) =>
        typeof plugin === 'string' ? plugin : (plugin as any).plugin
      );
      expect(loaded).toEqual(['test-plugin']);

      // Kept out of the set this process holds, and put down as soon as it has
      // answered, so the worker does not outlive the question.
      const instance = await mocks.loadForCapabilities.mock.results[0].value;
      expect(instance.dispose).toHaveBeenCalled();
      expect(loadIsolatedNxPlugin).not.toHaveBeenCalled();
      expect(useIsolatedNxPluginCapabilities).not.toHaveBeenCalled();

      // Written, so the next command reads it instead of loading again.
      expect(mocks.recordCapabilities).toHaveBeenCalledWith([
        expect.objectContaining({ key: 'key:test-plugin' }),
      ]);
    });

    it('declines when a plugin it has to load fails', async () => {
      mocks.loadForCapabilities.mockRejectedValue(new Error('boom'));

      // Null sends the caller to its own load, which reports the failure with
      // the plugin name and the context it expects.
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

  describe('capabilitiesOfConfiguredPlugins', () => {
    it('answers from the records without loading a plugin', async () => {
      everythingRecorded = true;

      const capabilities = await capabilitiesOfConfiguredPlugins({
        plugins: ['test-plugin'],
      });

      expect(capabilities[0]).toEqual(CAPABILITIES);
      // The whole point: a caller that needs the answer either way still does
      // not put the plugin set in this process to get it.
      expect(loadIsolatedNxPlugin).not.toHaveBeenCalled();
    });

    it('loads the plugins when no record can be kept', async () => {
      // A plugin with nothing to key a record on, which is one of the ways
      // peeking declines outright.
      const capabilities = await capabilitiesOfConfiguredPlugins({
        plugins: ['unidentifiable-plugin'],
      });

      // Answered anyway, from what the load reports, so the caller has one
      // shape to handle rather than a null to turn into a load itself.
      expect(loadIsolatedNxPlugin).toHaveBeenCalled();
      expect(capabilities.map((c) => c.createNodesPattern)).toContain(
        '**/*.config.ts'
      );
    });
  });
});
