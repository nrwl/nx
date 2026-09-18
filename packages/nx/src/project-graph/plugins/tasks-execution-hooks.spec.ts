import type { PluginCapabilities } from './graph-plugin-capabilities';
import {
  runPostTasksExecution,
  runPreTasksExecution,
} from './tasks-execution-hooks';

const mocks = vi.hoisted(() => ({
  getPlugins: vi.fn(),
  capabilitiesOfGraphReadFromCache: vi.fn(),
  isOnDaemon: vi.fn(),
  isDaemonEnabled: vi.fn(),
  daemonRunPreTasksExecution: vi.fn(),
  daemonRunPostTasksExecution: vi.fn(),
}));

vi.mock('./get-plugins', () => ({
  getPlugins: mocks.getPlugins,
}));

vi.mock('./graph-plugin-capabilities', () => ({
  capabilitiesOfGraphReadFromCache: mocks.capabilitiesOfGraphReadFromCache,
}));

vi.mock('../../daemon/is-on-daemon', () => ({
  isOnDaemon: mocks.isOnDaemon,
}));

vi.mock('../../daemon/client/client', () => ({
  isDaemonEnabled: mocks.isDaemonEnabled,
  daemonClient: {
    runPreTasksExecution: mocks.daemonRunPreTasksExecution,
    runPostTasksExecution: mocks.daemonRunPostTasksExecution,
  },
}));

vi.mock('../../config/nx-json', () => ({
  readNxJson: () => ({ plugins: ['@acme/plugin'] }),
}));

const INERT: PluginCapabilities = {
  name: '@acme/plugin',
  createNodesPattern: '**/*.config.ts',
  hasCreateDependencies: true,
  hasCreateMetadata: false,
  hasPreTasksExecution: false,
  hasPostTasksExecution: false,
};

function preTasksContext() {
  return {
    id: 'run-1',
    workspaceRoot: '/root',
    nxJsonConfiguration: {},
    argv: [],
  } as any;
}

function postTasksContext() {
  return {
    id: 'run-1',
    taskResults: { 'proj:build': { status: 'success' } },
    workspaceRoot: '/root',
    nxJsonConfiguration: {},
  } as any;
}

describe('task execution hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isOnDaemon.mockReturnValue(false);
    // The process that runs the hooks itself, as with the daemon off.
    mocks.isDaemonEnabled.mockReturnValue(false);
    mocks.capabilitiesOfGraphReadFromCache.mockReturnValue(null);
    mocks.getPlugins.mockResolvedValue([]);
    mocks.daemonRunPreTasksExecution.mockResolvedValue([]);
  });

  describe('runPreTasksExecution', () => {
    it('leaves it to the daemon when there is one, and loads nothing', async () => {
      mocks.isDaemonEnabled.mockReturnValue(true);

      await runPreTasksExecution(preTasksContext());

      expect(mocks.daemonRunPreTasksExecution).toHaveBeenCalled();
      expect(mocks.getPlugins).not.toHaveBeenCalled();
    });

    it('loads nothing when the build of the graph it read recorded no such hook', async () => {
      mocks.capabilitiesOfGraphReadFromCache.mockReturnValue([INERT]);

      await expect(runPreTasksExecution(preTasksContext())).resolves.toEqual(
        []
      );

      expect(mocks.getPlugins).not.toHaveBeenCalled();
    });

    it('loads and runs them when that build recorded the hook', async () => {
      const preTasksExecution = vi.fn(async () => ({ FROM_HOOK: '1' }));
      mocks.capabilitiesOfGraphReadFromCache.mockReturnValue([
        { ...INERT, hasPreTasksExecution: true },
      ]);
      mocks.getPlugins.mockResolvedValue([
        { name: '@acme/plugin', preTasksExecution },
      ]);

      await runPreTasksExecution(preTasksContext());

      expect(preTasksExecution).toHaveBeenCalled();
    });

    it('loads and runs them when nothing was recorded for its graph', async () => {
      // A process that built its own graph, or read one whose build recorded
      // nothing: it cannot tell, so it asks the plugins.
      const preTasksExecution = vi.fn(async () => ({}));
      mocks.getPlugins.mockResolvedValue([
        { name: '@acme/plugin', preTasksExecution },
      ]);

      await runPreTasksExecution(preTasksContext());

      expect(preTasksExecution).toHaveBeenCalled();
    });
  });

  describe('runPostTasksExecution', () => {
    it('leaves it to the daemon when there is one, and loads nothing', async () => {
      mocks.isDaemonEnabled.mockReturnValue(true);

      await runPostTasksExecution(postTasksContext());

      expect(mocks.daemonRunPostTasksExecution).toHaveBeenCalled();
      expect(mocks.getPlugins).not.toHaveBeenCalled();
    });

    it('loads nothing when the build of the graph it read recorded no such hook', async () => {
      mocks.capabilitiesOfGraphReadFromCache.mockReturnValue([INERT]);

      await runPostTasksExecution(postTasksContext());

      expect(mocks.getPlugins).not.toHaveBeenCalled();
    });

    it('loads and runs them when that build recorded the hook', async () => {
      const postTasksExecution = vi.fn(async () => {});
      mocks.capabilitiesOfGraphReadFromCache.mockReturnValue([
        { ...INERT, hasPostTasksExecution: true },
      ]);
      mocks.getPlugins.mockResolvedValue([
        { name: '@acme/plugin', postTasksExecution },
      ]);

      await runPostTasksExecution(postTasksContext());

      expect(postTasksExecution).toHaveBeenCalled();
    });
  });
});
