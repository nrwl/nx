import { buildProjectGraphAndSourceMapsWithoutDaemon } from './project-graph';
import * as plugins from './plugins/get-plugins';
import * as workspaceContext from '../utils/workspace-context';

jest.mock('../utils/workspace-context', () => {
  return {
    globWithWorkspaceContext: jest.fn().mockReturnValue(['file']),
    multiGlobWithWorkspaceContext: jest.fn().mockReturnValue(['file']),
    getNxWorkspaceFilesFromContext: jest.fn().mockReturnValue({
      projectFileMap: {},
      globalFiles: [],
      externalReferences: {},
    }),
  } satisfies Partial<typeof workspaceContext>;
});

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
      expect((e as Error).stack).toMatchInlineSnapshot(`
        "     - Error: Project graph construction cannot be performed due to a loop detected in the call stack. This can happen if 'createProjectGraphAsync' is called directly or indirectly during project graph construction.
          To avoid this, you can add a check against "global.NX_GRAPH_CREATION" before calling "createProjectGraphAsync".
          Call stack:
          async Object.<anonymous> (/Users/agentender/repos/nx2/packages/nx/src/project-graph/project-graph.spec.ts:32:23)
          async buildProjectGraphAndSourceMapsWithoutDaemon (/Users/agentender/repos/nx2/packages/nx/src/project-graph/project-graph.ts:94:31)
          retrieveProjectConfigurations (/Users/agentender/repos/nx2/packages/nx/src/project-graph/utils/retrieve-workspace-files.ts:47:85)
          createProjectConfigurationsWithPlugins (/Users/agentender/repos/nx2/packages/nx/src/project-graph/utils/project-configuration-utils.ts:272:17)
          mockConstructor (/Users/agentender/repos/nx2/node_modules/.pnpm/jest-mock@30.0.2/node_modules/jest-mock/build/index.js:102:19)
          /Users/agentender/repos/nx2/node_modules/.pnpm/jest-mock@30.0.2/node_modules/jest-mock/build/index.js:312:13
          /Users/agentender/repos/nx2/node_modules/.pnpm/jest-mock@30.0.2/node_modules/jest-mock/build/index.js:305:39
          /Users/agentender/repos/nx2/packages/nx/src/project-graph/project-graph.spec.ts:23:105
              at buildProjectGraphAndSourceMapsWithoutDaemon (/Users/agentender/repos/nx2/packages/nx/src/project-graph/project-graph.ts:114:11)
              at /Users/agentender/repos/nx2/packages/nx/src/project-graph/project-graph.spec.ts:25:74
              at /Users/agentender/repos/nx2/node_modules/.pnpm/jest-mock@30.0.2/node_modules/jest-mock/build/index.js:305:39
              at /Users/agentender/repos/nx2/node_modules/.pnpm/jest-mock@30.0.2/node_modules/jest-mock/build/index.js:312:13
              at mockConstructor (/Users/agentender/repos/nx2/node_modules/.pnpm/jest-mock@30.0.2/node_modules/jest-mock/build/index.js:102:19)
              at createProjectConfigurationsWithPlugins (/Users/agentender/repos/nx2/packages/nx/src/project-graph/utils/project-configuration-utils.ts:423:13)
              at retrieveProjectConfigurations (/Users/agentender/repos/nx2/packages/nx/src/project-graph/utils/retrieve-workspace-files.ts:77:48)
              at buildProjectGraphAndSourceMapsWithoutDaemon (/Users/agentender/repos/nx2/packages/nx/src/project-graph/project-graph.ts:130:27)
              at Object.<anonymous> (/Users/agentender/repos/nx2/packages/nx/src/project-graph/project-graph.spec.ts:36:17)"
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
