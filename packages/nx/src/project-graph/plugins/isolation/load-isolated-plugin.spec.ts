import type { Mock } from 'vitest';

// Hoisted so the second module copy in the two-copies test sees the same mock.
const mocked = vi.hoisted(() => ({
  IsolatedPlugin: {
    load: vi.fn(),
  },
}));

vi.mock('./isolated-plugin', () => mocked);

import { IsolatedPlugin } from './isolated-plugin';
import {
  disposeIsolatedPlugins,
  loadIsolatedNxPlugin,
  wantPlugins,
} from './load-isolated-plugin';

const load = IsolatedPlugin.load as unknown as Mock;
describe('the plugins a process has loaded', () => {
  let instances: Map<string, { name: string; dispose: Mock }>;

  beforeEach(() => {
    // The plugin map lives on `global`, so disposing everything is the reset.
    disposeIsolatedPlugins();
    instances = new Map();

    const newInstance = (name: string) => {
      const instance = { name, dispose: vi.fn() };
      instances.set(name, instance);
      return instance;
    };
    load.mockReset();
    load.mockImplementation(async (plugin: string) => newInstance(plugin));
  });

  it('loads one worker however many loads ask for the plugin', async () => {
    wantPlugins('specified', [{ plugin: 'p' }], '/root');

    const first = await loadIsolatedNxPlugin('p', '/root');
    const second = await loadIsolatedNxPlugin('p', '/root');

    expect(load).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it('keeps the plugins the next configuration still names', async () => {
    wantPlugins('specified', [{ plugin: 'a' }, { plugin: 'b' }], '/root');
    await loadIsolatedNxPlugin('a', '/root');
    await loadIsolatedNxPlugin('b', '/root');

    // `b` is gone from nx.json, `c` is new.
    wantPlugins('specified', [{ plugin: 'a' }, { plugin: 'c' }], '/root');
    await Promise.resolve();

    expect(instances.get('b').dispose).toHaveBeenCalled();
    expect(instances.get('a').dispose).not.toHaveBeenCalled();
    expect(await loadIsolatedNxPlugin('a', '/root')).toBe(instances.get('a'));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('reloads a plugin whose position in nx.json moved', async () => {
    wantPlugins('specified', [{ plugin: 'p', index: 0 }], '/root');
    const atZero = await loadIsolatedNxPlugin('p', '/root', 0);

    // `nx add` put another plugin in front of it.
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

    expect(instances.get('package-json').dispose).not.toHaveBeenCalled();
  });

  it('disposes a plugin that arrives after nothing wants it', async () => {
    wantPlugins('specified', [{ plugin: 'p' }], '/root');
    let finishLoading: (instance: unknown) => void;
    load.mockImplementationOnce(
      () => new Promise((resolve) => (finishLoading = resolve))
    );

    const stillLoading = loadIsolatedNxPlugin('p', '/root');

    // nx.json changed while that load was spawning its worker.
    wantPlugins('specified', [{ plugin: 'q' }], '/root');

    const instance = { dispose: vi.fn() };
    finishLoading!(instance);
    await stillLoading;

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

  it('sweeping a load that later fails disposes nothing', async () => {
    wantPlugins('specified', [{ plugin: 'p' }], '/root');
    let fail: (error: Error) => void;
    load.mockImplementationOnce(
      () => new Promise((_, reject) => (fail = reject))
    );

    const failed = loadIsolatedNxPlugin('p', '/root');
    disposeIsolatedPlugins();
    fail!(new Error('plugin blew up'));

    await expect(failed).rejects.toThrow('plugin blew up');
  });

  it('leaves the plugins another copy of Nx wanted alone', async () => {
    wantPlugins('specified', [{ plugin: 'a' }], '/root');
    await loadIsolatedNxPlugin('a', '/root');

    // The query suffix makes a second module instance; a plain re-import
    // returns the same module, even after `vi.resetModules()`.
    const second: typeof import('./load-isolated-plugin') =
      await import('./load-isolated-plugin?second-copy-of-nx');
    expect(second.wantPlugins).not.toBe(wantPlugins);
    second.wantPlugins('default', [{ plugin: 'b' }], '/root');
    await second.loadIsolatedNxPlugin('b', '/root');

    expect(instances.get('a').dispose).not.toHaveBeenCalled();
    expect(instances.get('b').dispose).not.toHaveBeenCalled();
  });
});
