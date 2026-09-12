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
  pluginGeneration,
  useIsolatedNxPluginCapabilities,
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
  let instances: Array<{ dispose: Mock }>;

  beforeEach(() => {
    // The map lives on `global` so two copies of Nx share one set of workers,
    // which also means it outlives a module reset. Sweeping it is the reset.
    disposeIsolatedPlugins();
    instances = [];

    const newInstance = () => {
      const instance = { dispose: vi.fn() };
      instances.push(instance);
      return instance;
    };
    load.mockReset();
    load.mockImplementation(async () => newInstance());
    fromCapabilities.mockReset();
    fromCapabilities.mockImplementation(() => newInstance());
  });

  it('loads one worker however many loads ask for the plugin', async () => {
    const generation = pluginGeneration();

    const first = await loadIsolatedNxPlugin('p', '/root', generation);
    const second = await loadIsolatedNxPlugin('p', '/root', generation);

    expect(load).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it('shares a plugin between a recorded wiring and a load', async () => {
    const generation = pluginGeneration();

    const wired = await useIsolatedNxPluginCapabilities(
      'p',
      '/root',
      generation,
      resolved,
      capabilities
    );
    const loaded = await loadIsolatedNxPlugin('p', '/root', generation);

    // Already wired from a record, so there is nothing to load.
    expect(load).not.toHaveBeenCalled();
    expect(fromCapabilities).toHaveBeenCalledTimes(1);
    expect(loaded).toBe(wired);
  });

  it('puts every loaded plugin down when the set is swept', async () => {
    const generation = pluginGeneration();
    await loadIsolatedNxPlugin('a', '/root', generation);
    await loadIsolatedNxPlugin('b', '/root', generation);

    disposeIsolatedPlugins();
    await Promise.resolve();

    expect(instances).toHaveLength(2);
    for (const instance of instances) {
      expect(instance.dispose).toHaveBeenCalled();
    }
  });

  it('loads again after a sweep', async () => {
    await loadIsolatedNxPlugin('p', '/root', pluginGeneration());
    disposeIsolatedPlugins();

    await loadIsolatedNxPlugin('p', '/root', pluginGeneration());

    // A disposed plugin is not reusable: its worker is gone for good, so the
    // entry has to go with it.
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('disposes a plugin whose load finishes after the sweep', async () => {
    const supersededGeneration = pluginGeneration();
    let finishLoading: (instance: unknown) => void;
    load.mockImplementationOnce(
      () => new Promise((resolve) => (finishLoading = resolve))
    );

    const stillLoading = loadIsolatedNxPlugin(
      'p',
      '/root',
      supersededGeneration
    );

    // The plugins changed while that load was in flight.
    disposeIsolatedPlugins();

    const instance = { dispose: vi.fn() };
    finishLoading!(instance);
    await stillLoading;

    // Its worker would otherwise run with nothing left to stop it, since the
    // sweep could not see a plugin that had not arrived yet.
    expect(instance.dispose).toHaveBeenCalled();
  });

  it('does not serve a superseded load to a later one', async () => {
    const supersededGeneration = pluginGeneration();
    await loadIsolatedNxPlugin('p', '/root', supersededGeneration);
    disposeIsolatedPlugins();

    // Arriving late, stamped with the generation its load started in.
    await loadIsolatedNxPlugin('p', '/root', supersededGeneration);
    const current = await loadIsolatedNxPlugin(
      'p',
      '/root',
      pluginGeneration()
    );

    // The current load gets a plugin of its own rather than the disposed one.
    expect(load).toHaveBeenCalledTimes(3);
    expect(current).toBe(instances[2]);
  });

  it('does not keep a failed load', async () => {
    load.mockRejectedValueOnce(new Error('plugin blew up'));

    await expect(
      loadIsolatedNxPlugin('p', '/root', pluginGeneration())
    ).rejects.toThrow('plugin blew up');

    await loadIsolatedNxPlugin('p', '/root', pluginGeneration());
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('sweeping a failed load disposes nothing', async () => {
    load.mockRejectedValueOnce(new Error('plugin blew up'));

    const failed = loadIsolatedNxPlugin('p', '/root', pluginGeneration());
    await expect(failed).rejects.toThrow('plugin blew up');

    // The rejection belongs to the caller that asked for the plugin; the sweep
    // must not turn it into an unhandled one.
    expect(() => disposeIsolatedPlugins()).not.toThrow();
    await Promise.resolve();
  });
});
