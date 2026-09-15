import { IsolatedPlugin } from './isolated-plugin';
import { loadIsolatedNxPlugin } from './load-isolated-plugin';

vi.mock('./isolated-plugin', () => ({
  IsolatedPlugin: { load: vi.fn() },
}));

describe('loadIsolatedNxPlugin', () => {
  const load = vi.mocked(IsolatedPlugin.load);

  beforeEach(() => {
    load.mockReset();
    load.mockImplementation(async () => ({}) as IsolatedPlugin);
  });

  // The worker bakes the conditions into its spawn args, so a plugin loaded
  // under different conditions needs its own worker rather than the cached one.
  it('keys the worker cache on the conditions the plugin was loaded with', async () => {
    const root = '/workspace/conditions-key';

    await loadIsolatedNxPlugin('plugin', root, 0, ['a']);
    await loadIsolatedNxPlugin('plugin', root, 0, ['b']);
    await loadIsolatedNxPlugin('plugin', root, 0, ['a']);

    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenNthCalledWith(1, 'plugin', root, 0, ['a']);
    expect(load).toHaveBeenNthCalledWith(2, 'plugin', root, 0, ['b']);
  });
});
