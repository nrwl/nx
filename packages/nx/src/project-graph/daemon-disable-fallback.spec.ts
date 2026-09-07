import type { MockedFunction } from 'vitest';

vi.unmock('./project-graph');
vi.mock('../daemon/client/client', () => ({
  daemonClient: {
    enabled: vi.fn(() => true),
    getProjectGraphAndSourceMaps: vi.fn(),
    reset: vi.fn(),
  },
}));
vi.mock('../daemon/tmp-dir', () => ({
  disableDaemonForThisProcess: vi.fn(),
  markDaemonAsDisabled: vi.fn(),
  writeDaemonLogs: vi.fn(() => '/tmp/daemon.log'),
}));
vi.mock('../daemon/sandbox-socket-hint', () => ({
  sandboxSocketHint: () => ['<hint>'],
}));
vi.mock('../utils/is-sandbox', () => ({ isSandbox: vi.fn() }));

import { daemonClient } from '../daemon/client/client';
import {
  disableDaemonForThisProcess,
  markDaemonAsDisabled,
} from '../daemon/tmp-dir';
import { isSandbox } from '../utils/is-sandbox';
import { output } from '../utils/output';
import * as projectGraph from './project-graph';

const mockIsSandbox = isSandbox as MockedFunction<typeof isSandbox>;
const mockGetGraph =
  daemonClient.getProjectGraphAndSourceMaps as MockedFunction<any>;
const mockReset = daemonClient.reset as MockedFunction<any>;

const internalDaemonError = () =>
  Object.assign(new Error('daemon blew up'), { internalDaemonError: true });

/**
 * Everything this suite asserts happens before the daemonless fallback, which
 * runs for real against no workspace. Its outcome is not the contract here.
 */
const buildAndIgnoreFallback = () =>
  projectGraph.createProjectGraphAndSourceMapsAsync().catch(() => {});

describe('daemon disable on an internal daemon error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(output, 'warn').mockImplementation(() => {});
    mockGetGraph.mockRejectedValue(internalDaemonError());
  });

  afterEach(() => vi.restoreAllMocks());

  // `enabled()` memoizes on `_enabled`, and `isDaemonDisabled()` is only read
  // while that is undefined. Without the reset, neither the in-memory disable
  // nor the on-disk marker reaches the client that already answered, so every
  // later daemon consumer in this process starts the daemon again and waits out
  // the full connect budget under a warning saying it is off.
  it.each([true, false])(
    'clears the memoized enabled() so the disable takes effect (sandboxed: %s)',
    async (sandboxed: boolean) => {
      mockIsSandbox.mockReturnValue(sandboxed);

      await buildAndIgnoreFallback();

      expect(mockReset).toHaveBeenCalled();
    }
  );

  it('leaves no on-disk marker when a sandbox is what refused', async () => {
    // The marker follows the checkout into an ordinary terminal and only
    // `nx reset` clears it, so one blocked command would turn the daemon off
    // everywhere -- including after the user did what Nx told them to do.
    mockIsSandbox.mockReturnValue(true);

    await buildAndIgnoreFallback();

    expect(disableDaemonForThisProcess).toHaveBeenCalledWith('daemon blew up');
    expect(markDaemonAsDisabled).not.toHaveBeenCalled();
  });

  it('still writes the marker outside a sandbox', async () => {
    mockIsSandbox.mockReturnValue(false);

    await buildAndIgnoreFallback();

    expect(markDaemonAsDisabled).toHaveBeenCalledWith('daemon blew up');
    expect(disableDaemonForThisProcess).not.toHaveBeenCalled();
  });
});
