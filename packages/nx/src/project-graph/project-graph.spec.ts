import { buildProjectGraphAndSourceMapsWithoutDaemon } from './project-graph';
import * as plugins from './plugins/get-plugins';

jest.mock(
  '../utils/workspace-context',
  () => {
    return {
      globWithWorkspaceContext: jest.fn().mockReturnValue(['file']),
      multiGlobWithWorkspaceContext: jest.fn().mockReturnValue(['file']),
      getNxWorkspaceFilesFromContext: jest.fn().mockReturnValue({
        projectFileMap: {},
        globalFiles: [],
        externalReferences: {},
      }),
    } satisfies Partial<typeof workspaceContext>;
  },
  {
    virtual: true,
  }
);

import * as workspaceContext from '../utils/workspace-context';
import { workspaceRoot } from '../utils/workspace-root';

declare global {
  var NX_GRAPH_CREATION: boolean;
}

describe('buildProjectGraphAndSourceMapsWithoutDaemon', () => {
  it('should throw an error if called recursively', async () => {
    const testPlugin = {
      name: 'test-plugin',
      createNodes: [
        '*',
        jest.fn().mockImplementation(async () => {
          const graph = await buildProjectGraphAndSourceMapsWithoutDaemon();
          return [];
        }),
      ],
    } as any;

    jest
      .spyOn(plugins, 'getPlugins')
      .mockImplementation(async () => [testPlugin]);

    try {
      const p = await buildProjectGraphAndSourceMapsWithoutDaemon();
    } catch (e) {
      const stack = (e as Error).stack?.toString() || '';
      const messageWithoutCallStack = stack.split('Call stack:')[0];
      expect(messageWithoutCallStack).toMatchInlineSnapshot(`
        "     - Error: Project graph construction cannot be performed due to a loop detected in the call stack. This can happen if 'createProjectGraphAsync' is called directly or indirectly during project graph construction.
          To avoid this, you can add a check against "global.NX_GRAPH_CREATION" before calling "createProjectGraphAsync".
          "
      `);
    } finally {
      expect(testPlugin.createNodes[1]).toHaveBeenCalled();
    }
    expect.assertions(2); // one for the catch, one for the finally. If only 1, the error was not thrown
  });

  it('should not throw an error if global.NX_GRAPH_CREATION is checked before calling createProjectGraphAsync', async () => {
    const testPlugin = {
      name: 'test-plugin',
      createNodes: [
        '*',
        jest.fn().mockImplementation(async () => {
          if (!global.NX_GRAPH_CREATION) {
            const graph = await buildProjectGraphAndSourceMapsWithoutDaemon();
          }
          return [];
        }),
      ],
    } as any;
    jest
      .spyOn(plugins, 'getPlugins')
      .mockImplementation(async () => [testPlugin]);

    const p = await buildProjectGraphAndSourceMapsWithoutDaemon();
    expect(testPlugin.createNodes[1]).toHaveBeenCalled();
  });

  it('should not throw an error if sane plugins are used and called in parallel', () => {
    const testPlugin = {
      name: 'test-plugin',
      createNodes: [
        '*',
        jest.fn().mockImplementation(async () => {
          return [];
        }),
      ],
    } as any;
    jest
      .spyOn(plugins, 'getPlugins')
      .mockImplementation(async () => [testPlugin]);

    return Promise.all([
      buildProjectGraphAndSourceMapsWithoutDaemon(),
      buildProjectGraphAndSourceMapsWithoutDaemon(),
      buildProjectGraphAndSourceMapsWithoutDaemon(),
    ]).then(() => {
      expect(testPlugin.createNodes[1]).toHaveBeenCalledTimes(3);
    });
  });
});
