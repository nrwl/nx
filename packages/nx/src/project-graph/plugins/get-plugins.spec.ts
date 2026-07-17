import { createSerializableError } from '../../utils/serializable-error';
import { reasonToError } from './get-plugins';

// Isolation off so loadingMethod() routes to loadNxPlugin, which we mock.
jest.mock('./isolation/enabled', () => ({
  isIsolationEnabled: () => false,
}));
jest.mock('./isolation', () => ({
  loadIsolatedNxPlugin: jest.fn(),
}));
jest.mock('../../adapter/angular-json', () => ({
  shouldMergeAngularProjects: () => false,
}));
jest.mock('./in-process-loader', () => ({
  loadNxPlugin: jest.fn(),
}));
// Resolution of local plugins relies on a cached workspace snapshot;
// loadSpecifiedNxPlugins must drop it on every reload. Mocked so the test can
// assert that wiring without touching the real filesystem-backed resolver.
jest.mock('./resolve-plugin', () => ({
  resetResolvePluginCache: jest.fn(),
}));

describe('reasonToError', () => {
  it('should return the same Error instance when given a real Error', () => {
    const error = new Error('real error');
    const result = reasonToError(error);
    expect(result).toBe(error);
  });

  it('should extract message from a serialized error object', () => {
    const original = new Error('Cannot find module @repro/my-plugin/plugin');
    const serialized = createSerializableError(original);

    // Serialized errors are plain objects, not Error instances
    expect(serialized).not.toBeInstanceOf(Error);

    const result = reasonToError(serialized);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('Cannot find module @repro/my-plugin/plugin');
    expect(result.stack).toBe(original.stack);
  });

  it('should handle a plain object with only a message property', () => {
    const result = reasonToError({ message: 'something went wrong' });
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('something went wrong');
  });

  it('should fall back to String() for non-object reasons', () => {
    expect(reasonToError('string reason').message).toBe('string reason');
    expect(reasonToError(42).message).toBe('42');
    expect(reasonToError(null).message).toBe('null');
    expect(reasonToError(undefined).message).toBe('undefined');
  });
});

describe('getPluginsSeparated', () => {
  let getPluginsSeparated: typeof import('./get-plugins').getPluginsSeparated;
  let loadNxPlugin: jest.Mock;
  // Resolver for each deferred specified-plugin load, keyed by plugin name.
  let pendingPluginLoads: Map<string, (plugin: unknown) => void>;

  beforeEach(() => {
    // Fresh module state per test — getPluginsSeparated caches at module
    // level, so a stale cache would mask the behavior under test.
    jest.resetModules();
    pendingPluginLoads = new Map();

    ({ loadNxPlugin } = require('./in-process-loader'));
    loadNxPlugin.mockImplementation((plugin: unknown) => {
      const name = typeof plugin === 'string' ? plugin : (plugin as any).plugin;
      // Default plugins load from absolute paths — resolve them immediately.
      // Only the `test-*` specified plugins are deferred, so a test controls
      // which load finishes first.
      if (!name.startsWith('test-')) {
        return [Promise.resolve({ name }), () => {}];
      }
      const promise = new Promise((resolve) => {
        pendingPluginLoads.set(name, resolve);
      });
      return [promise, () => {}];
    });

    ({ getPluginsSeparated } = require('./get-plugins'));
  });

  function finishLoading(pluginName: string) {
    const resolve = pendingPluginLoads.get(pluginName);
    if (!resolve) {
      throw new Error(`No pending load for plugin "${pluginName}"`);
    }
    resolve({ name: pluginName });
  }

  it('does not poison the cache when an older recompute finishes after a newer one', async () => {
    // Two recomputes race — as happens when a daemon restart fires an
    // initial recompute and a watcher recompute together — each snapshotting
    // a different nx.json plugin set.
    const olderCall = getPluginsSeparated({ plugins: ['test-a'] });
    const newerCall = getPluginsSeparated({ plugins: ['test-b'] });

    // The newer recompute (test-b) finishes first and commits the cache.
    finishLoading('test-b');
    const newerResult = await newerCall;
    expect(newerResult.specifiedPlugins.map((p) => p.name)).toEqual(['test-b']);

    // The older recompute (test-a) finishes last. It must NOT overwrite the
    // cache the newer recompute committed.
    finishLoading('test-a');
    await olderCall;

    // A later recompute reading the newer nx.json must get the newer plugin
    // set — not the stale set the older recompute loaded.
    const afterRace = await getPluginsSeparated({ plugins: ['test-b'] });
    expect(afterRace.specifiedPlugins.map((p) => p.name)).toEqual(['test-b']);
  });

  it('shares a single load between concurrent calls for the same plugin set', async () => {
    const first = getPluginsSeparated({ plugins: ['test-a'] });
    const second = getPluginsSeparated({ plugins: ['test-a'] });

    finishLoading('test-a');
    await Promise.all([first, second]);

    // test-a was loaded once, not once per caller.
    const testALoads = loadNxPlugin.mock.calls.filter(
      ([plugin]) => plugin === 'test-a'
    );
    expect(testALoads).toHaveLength(1);
  });

  it('drops the cached local-plugin resolution snapshot when loading the specified plugins', async () => {
    const { resetResolvePluginCache } = require('./resolve-plugin');
    expect(resetResolvePluginCache).not.toHaveBeenCalled();

    const load = getPluginsSeparated({ plugins: ['test-a'] });
    finishLoading('test-a');
    await load;

    // Loading the specified plugins must reset the resolver's workspace
    // snapshot. Without this a plugin added to nx.json after an earlier
    // resolution would be resolved against a stale project layout — missing
    // its own project — and collapse to the workspace root.
    expect(resetResolvePluginCache).toHaveBeenCalled();
  });
});
