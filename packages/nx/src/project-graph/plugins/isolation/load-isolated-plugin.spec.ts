import type { Mock } from 'vitest';

vi.mock('./isolated-plugin', () => ({
  IsolatedPlugin: {
    load: vi.fn(),
    fromCapabilities: vi.fn(),
  },
}));

import { IsolatedPlugin } from './isolated-plugin';
import {
  disposeIsolatedPlugins,
  loadIsolatedNxPlugin,
  useIsolatedNxPluginCapabilities,
  wantPlugins,
} from './load-isolated-plugin';

const load = IsolatedPlugin.load as unknown as Mock;
const fromCapabilities = IsolatedPlugin.fromCapabilities as unknown as Mock;

const resolved = {
  name: 'test-plugin',
  pluginPath: '/root/plugin.js',
  shouldRegisterTSTranspiler: false,
};

const capabilities = {
  name: 'test-plugin',
  createNodesPattern: '**/*.json',
  hasCreateDependencies: false,
  hasCreateMetadata: false,
  hasPreTasksExecution: false,
  hasPostTasksExecution: false,
};

describe('the plugins a process has loaded', () => {
  let instances: Map<string, { name: string; dispose: Mock }>;

  beforeEach(() => {
    // The map lives on `global` so two copies of Nx share one set of workers,
    // which also means it outlives a module reset. Wanting nothing is the reset.
    disposeIsolatedPlugins();
    instances = new Map();

    const newInstance = (name: string) => {
      const instance = { name, dispose: vi.fn() };
      instances.set(name, instance);
      return instance;
    };
    load.mockReset();
    load.mockImplementation(async (plugin: string) => newInstance(plugin));
    fromCapabilities.mockReset();
    fromCapabilities.mockImplementation((plugin: string) =>
      newInstance(plugin)
    );
  });

  it('loads one worker however many loads ask for the plugin', async () => {
    wantPlugins('specified', [{ plugin: 'p' }], '/root');

    const first = await loadIsolatedNxPlugin('p', '/root');
    const second = await loadIsolatedNxPlugin('p', '/root');

    expect(load).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it('shares a plugin between a recorded wiring and a load', async () => {
    wantPlugins('specified', [{ plugin: 'p' }], '/root');

    const wired = await useIsolatedNxPluginCapabilities(
      'p',
      '/root',
      resolved,
      capabilities
    );
    const loaded = await loadIsolatedNxPlugin('p', '/root');

    // Already wired from a record, so there is nothing to load.
    expect(load).not.toHaveBeenCalled();
    expect(fromCapabilities).toHaveBeenCalledTimes(1);
    expect(loaded).toBe(wired);
  });

  it('keeps the plugins the next configuration still names', async () => {
    wantPlugins('specified', [{ plugin: 'a' }, { plugin: 'b' }], '/root');
    await loadIsolatedNxPlugin('a', '/root');
    await loadIsolatedNxPlugin('b', '/root');

    // `b` is gone from nx.json, `c` is new.
    wantPlugins('specified', [{ plugin: 'a' }, { plugin: 'c' }], '/root');
    await Promise.resolve();

    expect(instances.get('b').dispose).toHaveBeenCalled();
    // Tearing `a` down would cost a reload of a plugin the new set is about to
    // ask for again.
    expect(instances.get('a').dispose).not.toHaveBeenCalled();
    expect(await loadIsolatedNxPlugin('a', '/root')).toBe(instances.get('a'));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('reloads a plugin whose position in nx.json moved', async () => {
    wantPlugins('specified', [{ plugin: 'p', index: 0 }], '/root');
    const atZero = await loadIsolatedNxPlugin('p', '/root', 0);

    // `nx add` put another plugin in front of it. Its configuration is
    // unchanged, but a plugin carries the index of the entry it came from, and
    // an exclusion written against a stale one lands on the wrong entry.
    wantPlugins('specified', [{ plugin: 'p', index: 1 }], '/root');
    await Promise.resolve();
    await loadIsolatedNxPlugin('p', '/root', 1);

    expect(load).toHaveBeenCalledTimes(2);
    expect(load.mock.calls.map(([, , index]) => index)).toEqual([0, 1]);
    expect((atZero as any).dispose).toHaveBeenCalled();
  });

  it("leaves another loader's plugins alone", async () => {
    wantPlugins('default', [{ plugin: 'package-json' }], '/root');
    await loadIsolatedNxPlugin('package-json', '/root');

    wantPlugins('specified', [{ plugin: 'a' }], '/root');
    await Promise.resolve();

    // The two halves are loaded by separate callers, so one declaring its own
    // must not take down the other's.
    expect(instances.get('package-json').dispose).not.toHaveBeenCalled();
  });

  it('disposes a plugin that arrives after nothing wants it', async () => {
    wantPlugins('specified', [{ plugin: 'p' }], '/root');
    let finishLoading: (instance: unknown) => void;
    load.mockImplementationOnce(
      () => new Promise((resolve) => (finishLoading = resolve))
    );

    const stillLoading = loadIsolatedNxPlugin('p', '/root');

    // nx.json changed while that load waited for the capabilities lock.
    wantPlugins('specified', [{ plugin: 'q' }], '/root');

    const instance = { dispose: vi.fn() };
    finishLoading!(instance);
    await stillLoading;

    // Its worker would otherwise run with nothing left to stop it: the sweep
    // could not see a plugin that had not arrived yet.
    expect(instance.dispose).toHaveBeenCalled();
  });

  it('keeps a plugin that arrives late but is still named', async () => {
    wantPlugins('specified', [{ plugin: 'p' }], '/root');
    let finishLoading: (instance: unknown) => void;
    load.mockImplementationOnce(
      () => new Promise((resolve) => (finishLoading = resolve))
    );

    const stillLoading = loadIsolatedNxPlugin('p', '/root');

    // A different plugin was added, and `p` is still configured.
    wantPlugins('specified', [{ plugin: 'p' }, { plugin: 'q' }], '/root');

    const instance = { dispose: vi.fn() };
    finishLoading!(instance);

    expect(await stillLoading).toBe(instance);
    expect(instance.dispose).not.toHaveBeenCalled();
  });

  it('puts every plugin down when nothing wants any of them', async () => {
    wantPlugins('specified', [{ plugin: 'a' }], '/root');
    wantPlugins('default', [{ plugin: 'package-json' }], '/root');
    await loadIsolatedNxPlugin('a', '/root');
    await loadIsolatedNxPlugin('package-json', '/root');

    disposeIsolatedPlugins();
    await Promise.resolve();

    for (const instance of instances.values()) {
      expect(instance.dispose).toHaveBeenCalled();
    }
  });

  it('does not keep a failed load', async () => {
    wantPlugins('specified', [{ plugin: 'p' }], '/root');
    load.mockRejectedValueOnce(new Error('plugin blew up'));

    await expect(loadIsolatedNxPlugin('p', '/root')).rejects.toThrow(
      'plugin blew up'
    );

    await loadIsolatedNxPlugin('p', '/root');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('sweeping a failed load disposes nothing', async () => {
    wantPlugins('specified', [{ plugin: 'p' }], '/root');
    load.mockRejectedValueOnce(new Error('plugin blew up'));

    const failed = loadIsolatedNxPlugin('p', '/root');
    await expect(failed).rejects.toThrow('plugin blew up');

    // The rejection belongs to the caller that asked for the plugin; the sweep
    // must not turn it into an unhandled one.
    expect(() => disposeIsolatedPlugins()).not.toThrow();
    await Promise.resolve();
  });
});
