const mocks = vi.hoisted(() => ({
  isOnDaemon: vi.fn(),
  isDaemonEnabled: vi.fn(),
  getPluginCapabilities: vi.fn(),
  capabilitiesOfGraphReadFromCache: vi.fn(),
  loadIsolatedNxPlugin: vi.fn(),
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
});
