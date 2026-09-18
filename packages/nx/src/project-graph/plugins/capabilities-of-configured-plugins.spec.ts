const mocks = vi.hoisted(() => ({
  isOnDaemon: vi.fn(),
  isDaemonEnabled: vi.fn(),
  getPluginCapabilities: vi.fn(),
  capabilitiesOfGraphReadFromCache: vi.fn(),
  loadNxPlugin: vi.fn(),
}));

vi.mock('../../daemon/is-on-daemon', () => ({ isOnDaemon: mocks.isOnDaemon }));
vi.mock('../../daemon/client/client', () => ({
  isDaemonEnabled: mocks.isDaemonEnabled,
  daemonClient: { getPluginCapabilities: mocks.getPluginCapabilities },
}));
vi.mock('./graph-plugin-capabilities', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./graph-plugin-capabilities')>()),
  capabilitiesOfGraphReadFromCache: mocks.capabilitiesOfGraphReadFromCache,
}));

vi.mock('./isolation/enabled', () => ({ isIsolationEnabled: () => false }));
vi.mock('./isolation', () => ({
  loadIsolatedNxPlugin: vi.fn(),
  disposeIsolatedPlugins: vi.fn(),
  wantPlugins: vi.fn(),
}));
vi.mock('../../adapter/angular-json', () => ({
  shouldMergeAngularProjects: () => false,
}));
vi.mock('./in-process-loader', () => ({ loadNxPlugin: mocks.loadNxPlugin }));
vi.mock('./resolve-plugin', () => ({ resetResolvePluginCache: vi.fn() }));

import { capabilitiesOfConfiguredPlugins } from './get-plugins';

const VITE = {
  name: '@nx/vite/plugin',
  createNodesPattern: '**/vite.config.{js,ts}',
  hasCreateDependencies: false,
  hasCreateMetadata: false,
  hasPreTasksExecution: false,
  hasPostTasksExecution: false,
};

describe('capabilitiesOfConfiguredPlugins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isOnDaemon.mockReturnValue(false);
    mocks.isDaemonEnabled.mockReturnValue(false);
    mocks.capabilitiesOfGraphReadFromCache.mockReturnValue(null);
  });

  it('asks the daemon when there is one, and loads nothing', async () => {
    mocks.isDaemonEnabled.mockReturnValue(true);
    mocks.getPluginCapabilities.mockResolvedValue([VITE]);

    await expect(capabilitiesOfConfiguredPlugins({})).resolves.toEqual([VITE]);
    expect(mocks.capabilitiesOfGraphReadFromCache).not.toHaveBeenCalled();
  });

  it('answers from what the build of its cached graph recorded', async () => {
    mocks.capabilitiesOfGraphReadFromCache.mockReturnValue([VITE]);

    await expect(capabilitiesOfConfiguredPlugins({})).resolves.toEqual([VITE]);
    expect(mocks.getPluginCapabilities).not.toHaveBeenCalled();
  });

  it('loads the plugins when nothing else can answer', async () => {
    mocks.loadNxPlugin.mockImplementation(async (plugin: string) =>
      plugin === VITE.name
        ? { name: plugin, createNodes: [VITE.createNodesPattern, vi.fn()] }
        : { name: plugin }
    );

    const capabilities = await capabilitiesOfConfiguredPlugins(
      { plugins: [VITE.name] },
      '/root'
    );

    expect(capabilities[0]).toEqual(VITE);
    expect(mocks.loadNxPlugin).toHaveBeenCalledWith(VITE.name, '/root', 0);
  });
});
