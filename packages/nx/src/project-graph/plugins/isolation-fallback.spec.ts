import type { MockInstance, MockedFunction } from 'vitest';
vi.mock('./isolation/enabled', async () => ({
  isIsolationEnabled: () => true,
}));
vi.mock('./isolation', async () => ({ loadIsolatedNxPlugin: vi.fn() }));
vi.mock('./in-process-loader', async () => ({ loadNxPlugin: vi.fn() }));
vi.mock('../../utils/is-sandbox', async () => ({ isSandbox: vi.fn() }));
vi.mock('../../native', async () => ({
  ...(await vi.importActual('../../native')),
  isAiAgent: vi.fn(() => false),
}));
vi.mock('../../daemon/sandbox-socket-hint', async () => ({
  sandboxSocketHint: vi.fn(() => ['<hint>']),
}));

import { loadIsolatedNxPlugin } from './isolation';
import { loadNxPlugin } from './in-process-loader';
import { isSandbox } from '../../utils/is-sandbox';
import { isAiAgent } from '../../native';
import { sandboxSocketHint } from '../../daemon/sandbox-socket-hint';
import { output } from '../../utils/output';
import { loadingMethod, resetIsolationFallbackForTesting } from './get-plugins';

const mockIsolated = loadIsolatedNxPlugin as MockedFunction<any>;
const mockInProcess = loadNxPlugin as MockedFunction<any>;
const mockIsSandbox = isSandbox as MockedFunction<typeof isSandbox>;
const mockIsAiAgent = isAiAgent as MockedFunction<typeof isAiAgent>;
const mockHint = sandboxSocketHint as MockedFunction<typeof sandboxSocketHint>;

/** The shape `loadIsolatedNxPlugin` resolves to: [pluginPromise, cleanup]. */
const isolatedResolving = (value: any) =>
  Promise.resolve([Promise.resolve(value), vi.fn()]);
const isolatedRejecting = (err: unknown, cleanup = vi.fn()) =>
  Promise.resolve([Promise.reject(err), cleanup]);

const startupFailure = () => {
  const e = new Error('Plugin worker exited before the connection');
  e[Symbol.for('nx.pluginWorkerStartupFailure')] = true;
  return e;
};

/** What the host builds when the worker exits with the socket-refused code. */
const socketRefusal = () => {
  const e = startupFailure();
  e[Symbol.for('nx.pluginWorkerSocketRefused')] = true;
  return e;
};

describe('plugin isolation fallback', () => {
  let warn: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    resetIsolationFallbackForTesting();
    warn = vi.spyOn(output, 'warn').mockImplementation(() => {});
    mockInProcess.mockReturnValue([Promise.resolve('in-process'), vi.fn()]);
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

  it('warns once when every plugin is loaded concurrently', async () => {
    // The production shape: callers map over the plugins and await them
    // together, so all of them are past the latch's entry check before the
    // first worker dies and each arrives at the catch with its own failure.
    // Awaiting sequentially, as the test above does, hides that.
    mockIsSandbox.mockReturnValue(true);
    mockIsolated.mockReturnValue(isolatedRejecting(startupFailure()));

    const loaded = await Promise.all(
      ['a', 'b', 'c'].map(([p]) => loadingMethod(p, '/root'))
    );

    expect(warn).toHaveBeenCalledTimes(1);
    // Every plugin still gets loaded; only the advice is deduped.
    expect(mockInProcess).toHaveBeenCalledTimes(3);
    expect(await Promise.all(loaded.map(([plugin]) => plugin))).toEqual([
      'in-process',
      'in-process',
      'in-process',
    ]);
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

describe('falling back on the worker errno rather than the environment', () => {
  // Copilot CLI's sandbox sets none of the variables `isSandbox()` reads
  // (measured on 1.0.80), so without the errno path the fallback never fires
  // there and every command loses its plugin workers with no explanation.
  let warn: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    resetIsolationFallbackForTesting();
    warn = vi.spyOn(output, 'warn').mockImplementation(() => {});
    mockInProcess.mockReturnValue([Promise.resolve('in-process'), vi.fn()]);
  });

  afterEach(() => warn.mockRestore());

  it('should fall back when the worker proves a refusal under an agent no sandbox variable covers', async () => {
    mockIsSandbox.mockReturnValue(false);
    mockIsAiAgent.mockReturnValue(true);
    mockIsolated.mockReturnValue(isolatedRejecting(socketRefusal()));

    const [plugin] = await loadingMethod({ plugin: 'p' } as any, '/root', 0);

    await expect(plugin).resolves.toBe('in-process');
  });

  it('should rethrow a refusal outside an agent, where losing isolation silently would be worse', async () => {
    // A root-owned socket dir on an ordinary workstation. Degrading here would
    // hide a real permissions problem behind a slower graph build.
    mockIsSandbox.mockReturnValue(false);
    mockIsAiAgent.mockReturnValue(false);
    mockIsolated.mockReturnValue(isolatedRejecting(socketRefusal()));

    await expect(
      loadingMethod({ plugin: 'p' } as any, '/root', 0).then(([p]) => p)
    ).rejects.toThrow('Plugin worker exited');
  });

  it('should rethrow a startup failure that is neither a refusal nor in a sandbox', async () => {
    // An OOM-killed worker or a broken install: no errno, no environment.
    mockIsSandbox.mockReturnValue(false);
    mockIsAiAgent.mockReturnValue(true);
    mockIsolated.mockReturnValue(isolatedRejecting(startupFailure()));

    await expect(
      loadingMethod({ plugin: 'p' } as any, '/root', 0).then(([p]) => p)
    ).rejects.toThrow('Plugin worker exited');
  });

  it('should still fall back on the environment alone, so detectable sandboxes keep working', async () => {
    mockIsSandbox.mockReturnValue(true);
    mockIsAiAgent.mockReturnValue(false);
    mockIsolated.mockReturnValue(isolatedRejecting(startupFailure()));

    const [plugin] = await loadingMethod({ plugin: 'p' } as any, '/root', 0);

    await expect(plugin).resolves.toBe('in-process');
  });

  it('should treat the errno as proof even when the environment is what allowed the fallback', async () => {
    // Proof and policy are separate: a worker that proved EPERM inside a
    // detectable sandbox should still say so outright rather than hedging.
    mockIsSandbox.mockReturnValue(true);
    mockIsAiAgent.mockReturnValue(false);
    mockIsolated.mockReturnValue(isolatedRejecting(socketRefusal()));

    await loadingMethod({ plugin: 'p' } as any, '/root', 0);

    expect(mockHint).toHaveBeenCalledWith({ certain: true });
  });

  it('should hedge when only the environment, not an errno, put us here', async () => {
    mockIsSandbox.mockReturnValue(true);
    mockIsAiAgent.mockReturnValue(false);
    mockIsolated.mockReturnValue(isolatedRejecting(startupFailure()));

    await loadingMethod({ plugin: 'p' } as any, '/root', 0);

    expect(mockHint).toHaveBeenCalledWith({ certain: false });
  });

  it('should not assert a sandbox for an agent the hint declines to name', async () => {
    // `isAiAgent()` covers gemini, cursor, opencode, replit and the VS Code
    // copilot extension, none of which `sandboxSpecificRemedy` names a setting
    // for. A title claiming a sandbox would sit above a body that deliberately
    // does not claim one.
    mockIsSandbox.mockReturnValue(false);
    mockIsAiAgent.mockReturnValue(true);
    mockIsolated.mockReturnValue(isolatedRejecting(socketRefusal()));

    await loadingMethod({ plugin: 'p' } as any, '/root', 0);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0].title).not.toContain('sandbox');
    expect(warn.mock.calls[0][0].title).toContain('denied permission');
  });
});
