const mockGlob = vi.fn();
const mockMultiGlob = vi.fn();
const mockDaemonGlob = vi.fn();
const mockDaemonMultiGlob = vi.fn();
const mockEnabled = vi.fn();
const mockIsOnDaemon = vi.fn();
const mockReady = vi.fn();

// The source lazy-requires ../native (CJS channel), which vi.mock cannot
// intercept. Mutate the CJS instance directly; each test file runs in its own
// forked process, so the mutation cannot leak to other files.
const cjsNative = require('../native');
cjsNative.WorkspaceContext = vi.fn().mockImplementation(function (
  root: string
) {
  return {
    glob: mockGlob,
    multiGlob: mockMultiGlob,
    ready: mockReady,
    workspaceRoot: root,
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
  startWorkspaceContext,
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

describe('which constructor a process uses', () => {
  const fromArchive = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkspaceContext();
    mockEnabled.mockReturnValue(false);
    mockIsOnDaemon.mockReturnValue(false);
    mockGlob.mockReturnValue(['result']);
    (cjsNative.WorkspaceContext as any).fromArchive =
      fromArchive.mockImplementation(() => ({
        glob: mockGlob,
        multiGlob: mockMultiGlob,
        workspaceRoot: '/virtual',
      }));
  });

  afterEach(() => {
    delete (global as any).NX_PLUGIN_WORKER;
  });

  it('a plugin worker loads the archive its host wrote instead of walking', async () => {
    (global as any).NX_PLUGIN_WORKER = true;

    await globWithWorkspaceContext('/virtual', ['**/*.ts']);

    expect(fromArchive).toHaveBeenCalledWith('/virtual', '/virtual/.nx');
    expect(cjsNative.WorkspaceContext).not.toHaveBeenCalled();
  });

  it('a host walks', async () => {
    await globWithWorkspaceContext('/virtual', ['**/*.ts']);

    expect(cjsNative.WorkspaceContext).toHaveBeenCalledWith(
      '/virtual',
      '/virtual/.nx'
    );
    expect(fromArchive).not.toHaveBeenCalled();
  });
});

describe('waiting for the walk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkspaceContext();
    mockEnabled.mockReturnValue(false);
    mockIsOnDaemon.mockReturnValue(false);
    mockReady.mockResolvedValue(undefined);
    mockGlob.mockReturnValue(['result']);
  });

  it('an async read waits for the files before touching the native context', async () => {
    await globWithWorkspaceContext('/virtual', ['**/*.ts']);

    expect(mockReady).toHaveBeenCalledTimes(1);
    expect(mockReady.mock.invocationCallOrder[0]).toBeLessThan(
      mockGlob.mock.invocationCallOrder[0]
    );
  });

  it('starting the context early begins the wait once and later reads reuse it', async () => {
    startWorkspaceContext('/some/root');
    await globWithWorkspaceContext('/some/root', ['**/*.ts']);
    await multiGlobWithWorkspaceContext('/some/root', ['**/*.ts']);

    expect(cjsNative.WorkspaceContext).toHaveBeenCalledTimes(1);
    expect(mockReady).toHaveBeenCalledTimes(1);
  });

  it('does not start a context in a client that will ask the daemon', () => {
    mockEnabled.mockReturnValue(true);

    startWorkspaceContext('/some/root');

    expect(cjsNative.WorkspaceContext).not.toHaveBeenCalled();
    expect(mockReady).not.toHaveBeenCalled();
  });
});
