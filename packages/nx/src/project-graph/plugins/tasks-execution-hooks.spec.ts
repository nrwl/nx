import type { PluginCapabilities } from './capabilities-cache';
import {
  runPostTasksExecution,
  runPreTasksExecution,
} from './tasks-execution-hooks';

const mocks = vi.hoisted(() => ({
  getPlugins: vi.fn(),
  peekPluginCapabilities: vi.fn(),
  isOnDaemon: vi.fn(),
  isDaemonEnabled: vi.fn(),
  daemonRunPreTasksExecution: vi.fn(),
  daemonRunPostTasksExecution: vi.fn(),
}));

vi.mock('./get-plugins', () => ({
  getPlugins: mocks.getPlugins,
  peekPluginCapabilities: mocks.peekPluginCapabilities,
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
    argv: [],
    startTime: 0,
    endTime: 1,
  } as any;
}

describe('task execution hooks', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    mocks.isOnDaemon.mockReturnValue(false);
    mocks.isDaemonEnabled.mockReturnValue(true);
    mocks.daemonRunPreTasksExecution.mockResolvedValue([]);
    mocks.daemonRunPostTasksExecution.mockResolvedValue(undefined);
    mocks.getPlugins.mockResolvedValue([]);
  });

  describe('runPreTasksExecution', () => {
    it('does nothing when the records show no plugin registers the hook', async () => {
      mocks.peekPluginCapabilities.mockResolvedValue([INERT]);

      expect(await runPreTasksExecution(preTasksContext())).toEqual([]);

      expect(mocks.getPlugins).not.toHaveBeenCalled();
      expect(mocks.daemonRunPreTasksExecution).not.toHaveBeenCalled();
    });

    it('asks the daemon when a plugin does register the hook', async () => {
      mocks.peekPluginCapabilities.mockResolvedValue([
        { ...INERT, hasPreTasksExecution: true },
      ]);

      await runPreTasksExecution(preTasksContext());

      expect(mocks.daemonRunPreTasksExecution).toHaveBeenCalled();
    });

    it('runs the hook when any plugin has no record', async () => {
      mocks.peekPluginCapabilities.mockResolvedValue(null);

      await runPreTasksExecution(preTasksContext());

      expect(mocks.daemonRunPreTasksExecution).toHaveBeenCalled();
    });

    it('loads no plugin in a process that runs the hooks itself', async () => {
      mocks.isDaemonEnabled.mockReturnValue(false);
      mocks.peekPluginCapabilities.mockResolvedValue([INERT]);

      await runPreTasksExecution(preTasksContext());

      expect(mocks.getPlugins).not.toHaveBeenCalled();
    });
  });

  describe('runPostTasksExecution', () => {
    it('keeps the task results off the socket when no plugin wants them', async () => {
      mocks.peekPluginCapabilities.mockResolvedValue([INERT]);

      await runPostTasksExecution(postTasksContext());

      // The context carries every task's result and terminal output, so not
      // sending it is the saving, not just the skipped hook.
      expect(mocks.daemonRunPostTasksExecution).not.toHaveBeenCalled();
      expect(mocks.getPlugins).not.toHaveBeenCalled();
    });

    it('sends them when a plugin does register the hook', async () => {
      mocks.peekPluginCapabilities.mockResolvedValue([
        { ...INERT, hasPostTasksExecution: true },
      ]);

      await runPostTasksExecution(postTasksContext());

      expect(mocks.daemonRunPostTasksExecution).toHaveBeenCalledWith(
        expect.objectContaining({ taskResults: expect.any(Object) })
      );
    });

    it('sends them when any plugin has no record', async () => {
      mocks.peekPluginCapabilities.mockResolvedValue(null);

      await runPostTasksExecution(postTasksContext());

      expect(mocks.daemonRunPostTasksExecution).toHaveBeenCalled();
    });
  });
});
