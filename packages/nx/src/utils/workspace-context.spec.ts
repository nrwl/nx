const mockGlob = vi.fn();
const mockMultiGlob = vi.fn();
const mockDaemonGlob = vi.fn();
const mockDaemonMultiGlob = vi.fn();
const mockEnabled = vi.fn();
const mockIsOnDaemon = vi.fn();

// The source lazy-requires ../native (CJS channel), which vi.mock cannot
// intercept. Mutate the CJS instance directly; each test file runs in its own
// forked process, so the mutation cannot leak to other files.
const cjsNative = require('../native');
cjsNative.WorkspaceContext = vi.fn().mockImplementation(function () {
  return {
    glob: mockGlob,
    multiGlob: mockMultiGlob,
    workspaceRoot: '/virtual',
  };
});
cjsNative.getMainWorktreeRoot = vi.fn().mockReturnValue('/virtual');

vi.mock('./cache-directory', () => ({
  workspaceDataDirectoryForWorkspace: vi.fn().mockReturnValue('/virtual/.nx'),
}));

vi.mock('../daemon/client/client', () => ({
  daemonClient: {
    enabled: () => mockEnabled(),
    glob: (...args: unknown[]) => mockDaemonGlob(...args),
    multiGlob: (...args: unknown[]) => mockDaemonMultiGlob(...args),
  },
}));

vi.mock('../daemon/is-on-daemon', () => ({
  isOnDaemon: () => mockIsOnDaemon(),
}));

import {
  globWithWorkspaceContext,
  multiGlobWithWorkspaceContext,
  resetWorkspaceContext,
} from './workspace-context';

describe('workspace-context /virtual short-circuit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkspaceContext();
    // Simulate the problematic case: daemon is enabled and we are NOT
    // running on the daemon (i.e. a generator test in a host process).
    mockEnabled.mockReturnValue(true);
    mockIsOnDaemon.mockReturnValue(false);
    mockGlob.mockReturnValue(['virtual-glob-result']);
    mockMultiGlob.mockReturnValue([['virtual-multiglob-result']]);
  });

  it('globWithWorkspaceContext bypasses the daemon when workspaceRoot is /virtual', async () => {
    const result = await globWithWorkspaceContext('/virtual', ['**/*.ts']);

    expect(mockDaemonGlob).not.toHaveBeenCalled();
    expect(mockGlob).toHaveBeenCalledWith(['**/*.ts'], undefined);
    expect(result).toEqual(['virtual-glob-result']);
  });

  it('multiGlobWithWorkspaceContext bypasses the daemon when workspaceRoot is /virtual', async () => {
    const result = await multiGlobWithWorkspaceContext('/virtual', ['**/*.ts']);

    expect(mockDaemonMultiGlob).not.toHaveBeenCalled();
    expect(mockMultiGlob).toHaveBeenCalledWith(['**/*.ts'], undefined);
    expect(result).toEqual([['virtual-multiglob-result']]);
  });

  it('multiGlobWithWorkspaceContext routes to the daemon for a real workspace root', async () => {
    mockDaemonMultiGlob.mockResolvedValueOnce([['daemon-result']]);

    const result = await multiGlobWithWorkspaceContext('/some/real/root', [
      '**/*.ts',
    ]);

    expect(mockMultiGlob).not.toHaveBeenCalled();
    expect(mockDaemonMultiGlob).toHaveBeenCalledWith(['**/*.ts'], undefined);
    expect(result).toEqual([['daemon-result']]);
  });
});
