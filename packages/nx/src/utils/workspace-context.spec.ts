const mockGlob = vi.fn();
const mockMultiGlob = vi.fn();
const mockDaemonGlob = vi.fn();
const mockDaemonMultiGlob = vi.fn();
const mockEnabled = vi.fn();
const mockIsOnDaemon = vi.fn();
const mockReady = vi.fn();
const mockRefresh = vi.fn();

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
    refresh: mockRefresh,
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
  refreshWorkspaceContext,
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
    let filesReady: () => void;
    mockReady.mockReturnValue(
      new Promise<void>((resolve) => (filesReady = resolve))
    );

    const read = globWithWorkspaceContext('/virtual', ['**/*.ts']);
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockReady).toHaveBeenCalledTimes(1);
    expect(mockGlob).not.toHaveBeenCalled();

    filesReady!();
    expect(await read).toEqual(['result']);
    expect(mockGlob).toHaveBeenCalledTimes(1);
  });

  it('later reads reuse the first wait', async () => {
    await globWithWorkspaceContext('/some/root', ['**/*.ts']);
    await multiGlobWithWorkspaceContext('/some/root', ['**/*.ts']);

    expect(cjsNative.WorkspaceContext).toHaveBeenCalledTimes(1);
    expect(mockReady).toHaveBeenCalledTimes(1);
  });
});

describe('refreshing the context before a graph build', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkspaceContext();
    mockEnabled.mockReturnValue(false);
    mockIsOnDaemon.mockReturnValue(false);
    mockReady.mockResolvedValue(undefined);
    mockGlob.mockReturnValue(['result']);
  });

  it('re-walks the existing context and makes the next read wait for it', async () => {
    await globWithWorkspaceContext('/some/root', ['**/*.ts']);

    refreshWorkspaceContext('/some/root');
    await globWithWorkspaceContext('/some/root', ['**/*.ts']);

    expect(cjsNative.WorkspaceContext).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    // The read after the refresh awaits its walk, not the first one.
    expect(mockReady).toHaveBeenCalledTimes(2);
  });

  it('walks fresh when there is no context for the root yet', () => {
    refreshWorkspaceContext('/some/root');

    expect(cjsNative.WorkspaceContext).toHaveBeenCalledTimes(1);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('leaves the context to the daemon when a client will ask it', () => {
    mockEnabled.mockReturnValue(true);

    refreshWorkspaceContext('/some/root');

    expect(cjsNative.WorkspaceContext).not.toHaveBeenCalled();
  });

  it('leaves the daemon to its watcher', () => {
    mockIsOnDaemon.mockReturnValue(true);

    refreshWorkspaceContext('/some/root');

    expect(cjsNative.WorkspaceContext).not.toHaveBeenCalled();
  });
});
