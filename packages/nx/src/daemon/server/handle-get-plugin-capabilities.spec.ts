const mocks = vi.hoisted(() => ({
  getPlugins: vi.fn(),
}));

vi.mock('../../project-graph/plugins/get-plugins', () => ({
  getPlugins: mocks.getPlugins,
}));
vi.mock('../../config/nx-json', () => ({ readNxJson: () => ({}) }));

import { handleGetPluginCapabilities } from './handle-get-plugin-capabilities';

describe('handleGetPluginCapabilities', () => {
  it('answers from the plugins the daemon has loaded', async () => {
    mocks.getPlugins.mockResolvedValue([
      {
        name: '@nx/vite/plugin',
        createNodes: ['**/vite.config.{js,ts}', async () => []],
      },
      { name: 'hooks-only', preTasksExecution: async () => ({}) },
    ]);

    const { response } = await handleGetPluginCapabilities();

    expect(response).toEqual([
      {
        name: '@nx/vite/plugin',
        createNodesPattern: '**/vite.config.{js,ts}',
        hasCreateDependencies: false,
        hasCreateMetadata: false,
        hasPreTasksExecution: false,
        hasPostTasksExecution: false,
      },
      {
        name: 'hooks-only',
        createNodesPattern: undefined,
        hasCreateDependencies: false,
        hasCreateMetadata: false,
        hasPreTasksExecution: true,
        hasPostTasksExecution: false,
      },
    ]);
  });
});
