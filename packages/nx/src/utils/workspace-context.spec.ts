const mockGlob = jest.fn();
const mockMultiGlob = jest.fn();
const mockDaemonGlob = jest.fn();
const mockDaemonMultiGlob = jest.fn();
const mockEnabled = jest.fn();
const mockIsOnDaemon = jest.fn();

jest.mock('../native', () => ({
  WorkspaceContext: jest.fn().mockImplementation(() => ({
    glob: mockGlob,
    multiGlob: mockMultiGlob,
    workspaceRoot: '/virtual',
  })),
  getMainWorktreeRoot: jest.fn().mockReturnValue('/virtual'),
}));

jest.mock('./cache-directory', () => ({
  workspaceDataDirectoryForWorkspace: jest.fn().mockReturnValue('/virtual/.nx'),
}));

jest.mock('../daemon/client/client', () => ({
  daemonClient: {
    enabled: () => mockEnabled(),
    glob: (...args: unknown[]) => mockDaemonGlob(...args),
    multiGlob: (...args: unknown[]) => mockDaemonMultiGlob(...args),
  },
}));

jest.mock('../daemon/is-on-daemon', () => ({
  isOnDaemon: () => mockIsOnDaemon(),
}));

import {
  globWithWorkspaceContext,
  multiGlobWithWorkspaceContext,
  resetWorkspaceContext,
} from './workspace-context';

describe('workspace-context /virtual short-circuit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
