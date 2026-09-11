import type { Mock } from 'vitest';

vi.mock('./isolated-plugin', () => ({
  IsolatedPlugin: {
    load: vi.fn(),
    fromCapabilities: vi.fn(),
  },
}));

import { IsolatedPlugin } from './isolated-plugin';
import {
  loadIsolatedNxPlugin,
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

describe('holding an isolated plugin', () => {
  let instances: Array<{ dispose: Mock }>;

  beforeEach(() => {
    // Held plugins live on `global`, so they survive a module reset and have to
    // be cleared here instead.
    (global['nxHeldPlugins'] as Map<string, unknown>).clear();
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

  it('loads one worker for two sets and disposes it when the last lets go', async () => {
    const [, releaseFirst] = await loadIsolatedNxPlugin('p', '/root');
    const [, releaseSecond] = await loadIsolatedNxPlugin('p', '/root');

    expect(load).toHaveBeenCalledTimes(1);

    releaseFirst();
    await Promise.resolve();
    // Another set still holds it, so disposing here would take down a worker
    // that set is relying on.
    expect(instances[0].dispose).not.toHaveBeenCalled();

    releaseSecond();
    await Promise.resolve();
    expect(instances[0].dispose).toHaveBeenCalled();
  });

  it('ignores a release that has already run', async () => {
    const [, releaseFirst] = await loadIsolatedNxPlugin('p', '/root');
    const [, releaseSecond] = await loadIsolatedNxPlugin('p', '/root');

    releaseFirst();
    releaseFirst();
    await Promise.resolve();

    // Two calls from one holder must not spend the other holder's count.
    expect(instances[0].dispose).not.toHaveBeenCalled();

    releaseSecond();
    await Promise.resolve();
    expect(instances[0].dispose).toHaveBeenCalled();
  });

  it('loads again after the last holder let go', async () => {
    const [, release] = await loadIsolatedNxPlugin('p', '/root');
    release();
    await Promise.resolve();

    await loadIsolatedNxPlugin('p', '/root');

    // A disposed plugin is not reusable: its worker is gone for good, so the
    // entry has to go with it.
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shares a plugin between a recorded wiring and a load', async () => {
    const [, releaseWired] = useIsolatedNxPluginCapabilities(
      'p',
      '/root',
      resolved,
      capabilities
    );
    const [, releaseLoaded] = await loadIsolatedNxPlugin('p', '/root');

    // Already wired from a record, so there is nothing to load.
    expect(load).not.toHaveBeenCalled();
    expect(fromCapabilities).toHaveBeenCalledTimes(1);

    releaseWired();
    await Promise.resolve();
    expect(instances[0].dispose).not.toHaveBeenCalled();

    releaseLoaded();
    await Promise.resolve();
    expect(instances[0].dispose).toHaveBeenCalled();
  });

  it('does not keep a failed load', async () => {
    load.mockRejectedValueOnce(new Error('plugin blew up'));

    const [failed] = await loadIsolatedNxPlugin('p', '/root');
    await expect(failed).rejects.toThrow('plugin blew up');

    await loadIsolatedNxPlugin('p', '/root');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('releasing a failed load disposes nothing', async () => {
    load.mockRejectedValueOnce(new Error('plugin blew up'));

    const [failed, release] = await loadIsolatedNxPlugin('p', '/root');
    await expect(failed).rejects.toThrow('plugin blew up');

    // The rejection belongs to the caller that asked for the plugin; the release
    // must not turn it into an unhandled one.
    expect(() => release()).not.toThrow();
    await Promise.resolve();
  });
});
