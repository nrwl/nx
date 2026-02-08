import { IsolatedPlugin, LoadResultPayload } from './isolated-plugin';

// We need to mock the dependencies before importing the class
jest.mock('../../../daemon/socket-utils', () => ({
  getPluginOsSocketPath: jest.fn(() => '/mock/socket/path'),
}));

jest.mock('../../../utils/installation-directory', () => ({
  getNxRequirePaths: jest.fn(() => ['/mock/require/path']),
}));

jest.mock('../resolve-plugin', () => ({
  resolveNxPlugin: jest.fn().mockResolvedValue({
    name: 'test-plugin',
    pluginPath: '/mock/plugin/path',
    shouldRegisterTSTranspiler: false,
  }),
}));

describe('IsolatedPlugin', () => {
  // Helper to create a mock load result
  function createLoadResult(
    hooks: Partial<{
      createNodesPattern: string;
      hasCreateDependencies: boolean;
      hasCreateMetadata: boolean;
      hasPreTasksExecution: boolean;
      hasPostTasksExecution: boolean;
    }>
  ): LoadResultPayload {
    return {
      name: 'test-plugin',
      createNodesPattern: hooks.createNodesPattern ?? '',
      hasCreateDependencies: hooks.hasCreateDependencies ?? false,
      hasProcessProjectGraph: false,
      hasCreateMetadata: hooks.hasCreateMetadata ?? false,
      hasPreTasksExecution: hooks.hasPreTasksExecution ?? false,
      hasPostTasksExecution: hooks.hasPostTasksExecution ?? false,
      success: true,
    };
  }

  /**
   * Creates an IsolatedPlugin instance with mocked internal methods.
   * This allows testing lifecycle behavior without spawning real workers.
   */
  function createTestPlugin(loadResult: LoadResultPayload) {
    // Create a minimal plugin instance using Object.create to bypass constructor
    // Use 'any' to work around TypeScript private property restrictions
    const plugin: any = Object.create(IsolatedPlugin.prototype);

    // Initialize required state
    plugin._alive = true;
    plugin.pendingCount = 0;
    plugin.spawnAndConnectCount = 0;
    plugin.shutdownCount = 0;

    // Mock spawnAndConnect
    const spawnAndConnect = jest.fn().mockImplementation(async () => {
      plugin._alive = true;
      plugin.spawnAndConnectCount++;
      return loadResult;
    });
    plugin.spawnAndConnect = spawnAndConnect;

    // Mock shutdown
    const shutdown = jest.fn().mockImplementation(() => {
      plugin._alive = false;
      plugin.shutdownCount++;
    });
    plugin.shutdown = shutdown;

    // Mock sendRequest to return success by default
    const sendRequest = jest.fn().mockImplementation(async (type: string) => {
      switch (type) {
        case 'createNodes':
          return { success: true, result: [] };
        case 'createDependencies':
          return { success: true, dependencies: [] };
        case 'createMetadata':
          return { success: true, metadata: {} };
        case 'preTasksExecution':
          return { success: true, mutations: {} };
        case 'postTasksExecution':
          return { success: true };
        default:
          return { success: false, error: new Error(`Unknown type: ${type}`) };
      }
    });
    plugin.sendRequest = sendRequest;

    // Set up the plugin by calling setupHooks
    plugin.name = loadResult.name;
    plugin.setupHooks(loadResult);

    return {
      plugin,
      spawnAndConnect,
      shutdown,
      sendRequest,
    };
  }

  describe('lifecycle integration', () => {
    it('should shutdown after single-hook plugin completes', async () => {
      const { plugin, shutdown } = createTestPlugin(
        createLoadResult({ createNodesPattern: '**/*.json' })
      );

      await plugin.createNodes![1]([], {} as any);

      expect(shutdown).toHaveBeenCalled();
    });

    it('should not shutdown after first hook if more hooks in phase', async () => {
      const { plugin, shutdown } = createTestPlugin(
        createLoadResult({
          createNodesPattern: '**/*.json',
          hasCreateDependencies: true,
        })
      );

      await plugin.createNodes![1]([], {} as any);

      expect(shutdown).not.toHaveBeenCalled();
    });

    it('should shutdown after last hook in phase when no later phases', async () => {
      const { plugin, shutdown } = createTestPlugin(
        createLoadResult({
          createNodesPattern: '**/*.json',
          hasCreateDependencies: true,
        })
      );

      await plugin.createNodes![1]([], {} as any);
      await plugin.createDependencies!({} as any);

      expect(shutdown).toHaveBeenCalledTimes(1);
    });

    it('should not shutdown after graph phase if task hooks exist', async () => {
      const { plugin, shutdown } = createTestPlugin(
        createLoadResult({
          createNodesPattern: '**/*.json',
          hasPostTasksExecution: true,
        })
      );

      await plugin.createNodes![1]([], {} as any);

      expect(shutdown).not.toHaveBeenCalled();
    });

    it('should shutdown immediately if no graph phase hooks', () => {
      const { shutdown } = createTestPlugin(
        createLoadResult({ hasPostTasksExecution: true })
      );

      // setupHooks should have called shutdown immediately
      expect(shutdown).toHaveBeenCalled();
    });
  });

  describe('restart on hook call after shutdown', () => {
    it('should restart worker when calling hook after shutdown', async () => {
      const { plugin, spawnAndConnect, shutdown } = createTestPlugin(
        createLoadResult({ hasPostTasksExecution: true })
      );

      // Plugin was shutdown immediately (post-task only)
      expect(shutdown).toHaveBeenCalledTimes(1);
      expect(plugin._alive).toBe(false);

      // Now call postTasksExecution - should restart first
      await plugin.postTasksExecution!({} as any);

      // Should have restarted
      expect(spawnAndConnect).toHaveBeenCalled();
      expect(plugin.spawnAndConnectCount).toBe(1);
    });

    it('should not restart if already alive', async () => {
      const { plugin } = createTestPlugin(
        createLoadResult({ createNodesPattern: '**/*.json' })
      );

      // Plugin is already alive
      expect(plugin._alive).toBe(true);
      const spawnCountBefore = plugin.spawnAndConnectCount;

      await plugin.createNodes![1]([], {} as any);

      // Should not have restarted
      expect(plugin.spawnAndConnectCount).toBe(spawnCountBefore);
    });

    it('should restart before each hook if plugin was shutdown between calls', async () => {
      const { plugin, shutdown } = createTestPlugin(
        createLoadResult({
          hasPreTasksExecution: true,
          hasPostTasksExecution: true,
        })
      );

      // Immediately shutdown (no graph hooks)
      expect(shutdown).toHaveBeenCalledTimes(1);

      // Call preTasksExecution - should restart
      await plugin.preTasksExecution!({} as any);
      expect(plugin.spawnAndConnectCount).toBe(1);

      // Should not shutdown yet (post-task hooks exist)
      expect(shutdown).toHaveBeenCalledTimes(1);

      // Now call postTasksExecution
      await plugin.postTasksExecution!({} as any);

      // Now should shutdown
      expect(shutdown).toHaveBeenCalledTimes(2);
    });
  });

  describe('concurrent calls', () => {
    it('should handle concurrent calls with ref counting', async () => {
      const { plugin, shutdown, sendRequest } = createTestPlugin(
        createLoadResult({ createNodesPattern: '**/*.json' })
      );

      // Control when sendRequest resolves
      let resolveA: (v: { success: true; result: any[] }) => void;
      let resolveB: (v: { success: true; result: any[] }) => void;
      const promiseA = new Promise<{ success: true; result: any[] }>(
        (r) => (resolveA = r)
      );
      const promiseB = new Promise<{ success: true; result: any[] }>(
        (r) => (resolveB = r)
      );

      let callCount = 0;
      sendRequest.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? promiseA : promiseB;
      });

      // Start two concurrent calls
      const callA = plugin.createNodes![1]([], {} as any);
      const callB = plugin.createNodes![1]([], {} as any);

      // Complete A first
      resolveA!({ success: true, result: [] });
      await callA;

      // Should NOT shutdown - B is still in progress
      expect(shutdown).not.toHaveBeenCalled();

      // Complete B
      resolveB!({ success: true, result: [] });
      await callB;

      // Now should shutdown
      expect(shutdown).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should propagate errors from sendRequest', async () => {
      const { plugin, sendRequest } = createTestPlugin(
        createLoadResult({ createNodesPattern: '**/*.json' })
      );

      sendRequest.mockResolvedValue({
        success: false,
        error: new Error('connection lost'),
      });

      await expect(plugin.createNodes![1]([], {} as any)).rejects.toThrow(
        'connection lost'
      );
    });

    it('should still allow shutdown after error', async () => {
      const { plugin, shutdown, sendRequest } = createTestPlugin(
        createLoadResult({ createNodesPattern: '**/*.json' })
      );

      sendRequest.mockResolvedValue({
        success: false,
        error: new Error('test error'),
      });

      await expect(plugin.createNodes![1]([], {} as any)).rejects.toThrow();

      // Shutdown should still be called (lifecycle cleanup happens in finally)
      expect(shutdown).toHaveBeenCalled();
    });
  });

  describe('metadata', () => {
    it('should expose name from load result', () => {
      const { plugin } = createTestPlugin(
        createLoadResult({ createNodesPattern: '**/*.json' })
      );

      expect(plugin.name).toBe('test-plugin');
    });
  });

  describe('all hook types', () => {
    it('should set up createMetadata correctly', async () => {
      const { plugin, sendRequest } = createTestPlugin(
        createLoadResult({ hasCreateMetadata: true })
      );

      const expectedMetadata = { projects: { app: { tags: ['frontend'] } } };
      sendRequest.mockResolvedValue({
        success: true,
        metadata: expectedMetadata,
      });

      expect(plugin.createMetadata).toBeDefined();

      const graph = { nodes: {}, dependencies: {} };
      const context = { workspaceRoot: '/root', nxJsonConfiguration: {} };
      const result = await plugin.createMetadata!(graph as any, context as any);

      expect(result).toBe(expectedMetadata);
      expect(sendRequest).toHaveBeenCalledWith('createMetadata', {
        graph,
        context,
      });
    });

    it('should set up preTasksExecution correctly', async () => {
      const { plugin, sendRequest } = createTestPlugin(
        createLoadResult({ hasPreTasksExecution: true })
      );

      const expectedEnv = { NODE_ENV: 'test' };
      sendRequest.mockResolvedValue({
        success: true,
        mutations: expectedEnv,
      });

      expect(plugin.preTasksExecution).toBeDefined();

      const context = { id: '1', workspaceRoot: '/root' };
      const result = await plugin.preTasksExecution!(context as any);

      expect(result).toBe(expectedEnv);
      expect(sendRequest).toHaveBeenCalledWith('preTasksExecution', {
        context,
      });
    });

    it('should set up postTasksExecution correctly', async () => {
      const loadResult = createLoadResult({
        createNodesPattern: '**/*.json', // Need graph hook to avoid immediate shutdown
        hasPostTasksExecution: true,
      });
      const { plugin, sendRequest } = createTestPlugin(loadResult);

      expect(plugin.postTasksExecution).toBeDefined();

      // First complete the graph phase
      await plugin.createNodes![1]([], {} as any);

      const context = { id: '1', workspaceRoot: '/root', taskResults: {} };
      await plugin.postTasksExecution!(context as any);

      expect(sendRequest).toHaveBeenCalledWith('postTasksExecution', {
        context,
      });
    });
  });

  describe('full lifecycle flow', () => {
    it('should handle post-task-only plugin correctly', async () => {
      const { plugin, shutdown, spawnAndConnect } = createTestPlugin(
        createLoadResult({ hasPostTasksExecution: true })
      );

      // 1. Plugin is shutdown immediately (no graph hooks)
      expect(shutdown).toHaveBeenCalledTimes(1);
      expect(plugin._alive).toBe(false);

      // 2. Later, when postTasksExecution is called, it should restart
      await plugin.postTasksExecution!({} as any);

      expect(spawnAndConnect).toHaveBeenCalled();
      expect(plugin.spawnAndConnectCount).toBe(1);

      // 3. After postTasksExecution completes, shutdown again
      expect(shutdown).toHaveBeenCalledTimes(2);
    });

    it('should handle plugin with all hooks', async () => {
      const { plugin, shutdown } = createTestPlugin(
        createLoadResult({
          createNodesPattern: '**/*.json',
          hasCreateDependencies: true,
          hasCreateMetadata: true,
          hasPreTasksExecution: true,
          hasPostTasksExecution: true,
        })
      );

      // Graph phase
      await plugin.createNodes![1]([], {} as any);
      expect(shutdown).not.toHaveBeenCalled(); // more hooks in phase

      await plugin.createDependencies!({} as any);
      expect(shutdown).not.toHaveBeenCalled(); // more hooks in phase

      await plugin.createMetadata!({} as any, {} as any);
      expect(shutdown).not.toHaveBeenCalled(); // later phases exist

      // Pre-task phase
      await plugin.preTasksExecution!({} as any);
      expect(shutdown).not.toHaveBeenCalled(); // post-task exists

      // Post-task phase
      await plugin.postTasksExecution!({} as any);
      expect(shutdown).toHaveBeenCalledTimes(1); // finally done
    });
  });
});
