jest.mock('./isolation/enabled', () => ({ isIsolationEnabled: () => true }));
jest.mock('./isolation', () => ({ loadIsolatedNxPlugin: jest.fn() }));
jest.mock('./in-process-loader', () => ({ loadNxPlugin: jest.fn() }));
jest.mock('../../utils/is-sandbox', () => ({ isSandbox: jest.fn() }));
jest.mock('../../daemon/sandbox-socket-hint', () => ({
  sandboxSocketHint: () => ['<hint>'],
}));

import { loadIsolatedNxPlugin } from './isolation';
import { loadNxPlugin } from './in-process-loader';
import { isSandbox } from '../../utils/is-sandbox';
import { output } from '../../utils/output';
import { loadingMethod, resetIsolationFallbackForTesting } from './get-plugins';

const mockIsolated = loadIsolatedNxPlugin as jest.MockedFunction<any>;
const mockInProcess = loadNxPlugin as jest.MockedFunction<any>;
const mockIsSandbox = isSandbox as jest.MockedFunction<typeof isSandbox>;

/** The shape `loadIsolatedNxPlugin` resolves to: [pluginPromise, cleanup]. */
const isolatedResolving = (value: any) =>
  Promise.resolve([Promise.resolve(value), jest.fn()]);
const isolatedRejecting = (err: unknown, cleanup = jest.fn()) =>
  Promise.resolve([Promise.reject(err), cleanup]);

const startupFailure = () => {
  const e = new Error('Plugin worker exited before the connection');
  e[Symbol.for('nx.pluginWorkerStartupFailure')] = true;
  return e;
};

describe('plugin isolation fallback', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    resetIsolationFallbackForTesting();
    warn = jest.spyOn(output, 'warn').mockImplementation(() => {});
    mockInProcess.mockReturnValue([Promise.resolve('in-process'), jest.fn()]);
  });

  afterEach(() => warn.mockRestore());

  it('uses the worker when it starts', async () => {
    mockIsSandbox.mockReturnValue(true);
    mockIsolated.mockReturnValue(isolatedResolving('isolated'));

    const [plugin] = await loadingMethod('p', '/root');

    expect(await plugin).toBe('isolated');
    expect(mockInProcess).not.toHaveBeenCalled();
  });

  it('falls back in-process when a sandbox refuses the worker socket', async () => {
    mockIsSandbox.mockReturnValue(true);
    mockIsolated.mockReturnValue(isolatedRejecting(startupFailure()));

    const [plugin] = await loadingMethod('p', '/root');

    expect(await plugin).toBe('in-process');
    expect(mockInProcess).toHaveBeenCalled();
  });

  it('says so rather than degrading silently, and names the remedy', async () => {
    // A silent downgrade leaves the user with slower, less isolated runs and no
    // reason to go configure their sandbox.
    mockIsSandbox.mockReturnValue(true);
    mockIsolated.mockReturnValue(isolatedRejecting(startupFailure()));

    await loadingMethod('p', '/root');

    expect(warn).toHaveBeenCalledTimes(1);
    const { title, bodyLines } = warn.mock.calls[0][0];
    expect(title).toContain('main process');
    expect(bodyLines).toContain('<hint>');
  });

  it('stops spawning workers once one has been refused', async () => {
    // Every plugin would otherwise repeat the whole sequence: spawn, wait for
    // the worker to die, print the same advice.
    mockIsSandbox.mockReturnValue(true);
    mockIsolated.mockReturnValue(isolatedRejecting(startupFailure()));

    await loadingMethod('a', '/root');
    await loadingMethod('b', '/root');
    await loadingMethod('c', '/root');

    expect(warn).toHaveBeenCalledTimes(1);
    // The first plugin tried a worker; the rest went straight in-process.
    expect(mockIsolated).toHaveBeenCalledTimes(1);
    expect(mockInProcess).toHaveBeenCalledTimes(3);
  });

  it('rethrows a plugin that loaded and then threw', async () => {
    // Falling back here would rerun a plugin that already failed on its own
    // merits and bury the real error.
    mockIsSandbox.mockReturnValue(true);
    mockIsolated.mockReturnValue(
      isolatedRejecting(new Error('plugin blew up'))
    );

    await expect(loadingMethod('p', '/root')).rejects.toThrow('plugin blew up');
    expect(mockInProcess).not.toHaveBeenCalled();
  });

  it('rethrows a worker startup failure outside a sandbox', async () => {
    // Outside a sandbox a dead worker is a real defect, not a policy refusal.
    mockIsSandbox.mockReturnValue(false);
    mockIsolated.mockReturnValue(isolatedRejecting(startupFailure()));

    await expect(loadingMethod('p', '/root')).rejects.toThrow(
      'Plugin worker exited'
    );
    expect(mockInProcess).not.toHaveBeenCalled();
  });
});
