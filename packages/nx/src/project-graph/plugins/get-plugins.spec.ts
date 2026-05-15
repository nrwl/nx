import { createSerializableError } from '../../utils/serializable-error';
import { reasonToError } from './get-plugins';

// Covers the daemon race where two recomputes call getPluginsSeparated
// back-to-back with the same NEW plugin config (after nx.json change).
// The earlier code path updated `currentPluginsConfigurationHash` to the
// new hash before populating `cachedSeparatedPlugins`, so a concurrent
// caller arriving in that window passed the cache check and received the
// STALE SeparatedPlugins from the previous load. In the daemon this
// surfaced as the project graph being built without the freshly-added
// specified plugins (see spread.test.ts middle-plugin flake).
describe('getPluginsSeparated — concurrent load of same new config', () => {
  it('does not serve stale cached plugins to a concurrent caller mid-load', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock('./isolation/enabled', () => ({
        __esModule: true,
        isIsolationEnabled: () => false,
      }));

      let firstLoadGate: () => void;
      const firstLoadParked = new Promise<void>((resolve) => {
        firstLoadGate = resolve;
      });

      let specifiedLoadCount = 0;
      const makeFakePlugin = (name: string) =>
        ({ name } as unknown as import('./loaded-nx-plugin').LoadedNxPlugin);

      // Only specified plugins (paths starting with "./") are gated;
      // default plugin loads (absolute paths from getDefaultPlugins)
      // run to completion so Promise.allSettled below progresses.
      jest.doMock('./in-process-loader', () => ({
        __esModule: true,
        loadNxPlugin: (config: unknown) => {
          const name =
            typeof config === 'string'
              ? config
              : (config as { plugin: string }).plugin ?? 'unknown';
          const isSpecifiedPlugin = name.startsWith('./');
          let parkThis = false;
          if (isSpecifiedPlugin) {
            specifiedLoadCount++;
            parkThis = specifiedLoadCount === 1;
          }
          const promise = (async () => {
            if (parkThis) await firstLoadParked;
            return makeFakePlugin(`loaded:${name}`);
          })();
          return [promise, () => {}] as const;
        },
      }));

      const { getPluginsSeparated } = require('./get-plugins');

      // Seed the cache with an EMPTY specified-plugin set so the race
      // window has a meaningfully stale value to return. This matches
      // the daemon's startup state right before the test mutates
      // nx.json to add specified plugins.
      const seed = await getPluginsSeparated({ plugins: [] }, '/tmp/fake-root');
      expect(seed.specifiedPlugins).toEqual([]);

      // First call after the nx.json change: falls through cache (hash
      // differs from seed), bumps currentPluginsConfigurationHash to the
      // NEW hash, and parks loading './tools/plugin-a'.
      const callA = getPluginsSeparated(
        { plugins: ['./tools/plugin-a'] },
        '/tmp/fake-root'
      );

      // Yield through the microtask + setImmediate queues so call A has
      // (synchronously) stamped `currentPluginsConfigurationHash` to the
      // NEW hash and is suspended on `Promise.allSettled` awaiting the
      // parked load.
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));

      // Concurrent call with the SAME new config arriving in that race
      // window. Without the fix it hits the cache check
      // (`cachedSeparatedPlugins && newHash === currentHash`) and gets
      // the seed's empty `specifiedPlugins` — the daemon would then
      // build a project graph with no specified plugins loaded.
      const callB = getPluginsSeparated(
        { plugins: ['./tools/plugin-a'] },
        '/tmp/fake-root'
      );

      // Unblock the parked load and let both calls settle.
      firstLoadGate!();
      const [resultA, resultB] = await Promise.all([callA, callB]);

      expect(resultA.specifiedPlugins).toHaveLength(1);
      expect(resultA.specifiedPlugins[0]).toMatchObject({
        name: 'loaded:./tools/plugin-a',
      });
      // The bug: B used to return `specifiedPlugins: []` because the
      // cache check passed with the seed's stale data still attached
      // to the freshly-updated hash.
      expect(resultB.specifiedPlugins).toHaveLength(1);
      expect(resultB.specifiedPlugins[0]).toMatchObject({
        name: 'loaded:./tools/plugin-a',
      });
      expect(resultA.specifiedPlugins.map((p: any) => p.name)).toEqual(
        resultB.specifiedPlugins.map((p: any) => p.name)
      );
    });
  });
});

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
