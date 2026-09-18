// The global setup (`vitest.setup.mts`) mocks
// `nx/src/project-graph/project-graph` to return an empty graph for every
// test, but this suite is the one place that exercises the real
// `buildProjectGraphAndSourceMapsWithoutDaemon` implementation, so opt out.
vi.unmock('./project-graph');

import {
  buildProjectGraphAndSourceMapsWithoutDaemon,
  handleProjectGraphError,
} from './project-graph';
import { CreateMetadataError, ProjectGraphError } from './error-types';
import { output } from '../utils/output';
import * as plugins from './plugins/get-plugins';

vi.mock('../utils/workspace-context', () => {
  return {
    refreshWorkspaceContext: vi.fn(),
    globWithWorkspaceContext: vi.fn().mockReturnValue(['file']),
    // multiGlob returns one file list per glob group (string[][]).
    multiGlobWithWorkspaceContext: vi.fn().mockReturnValue([['file']]),
    getNxWorkspaceFilesFromContext: vi.fn().mockReturnValue({
      projectFileMap: {},
      globalFiles: [],
      externalReferences: {},
    }),
  } satisfies Partial<typeof workspaceContext>;
});

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
        vi.fn().mockImplementation(async () => {
          const graph = await buildProjectGraphAndSourceMapsWithoutDaemon();
          return [];
        }),
      ],
    } as any;

    vi.spyOn(plugins, 'getPluginsSeparated').mockImplementation(async () => ({
      specifiedPlugins: [testPlugin],
      defaultPlugins: [],
    }));

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
        vi.fn().mockImplementation(async () => {
          if (!global.NX_GRAPH_CREATION) {
            const graph = await buildProjectGraphAndSourceMapsWithoutDaemon();
          }
          return [];
        }),
      ],
    } as any;
    vi.spyOn(plugins, 'getPluginsSeparated').mockImplementation(async () => ({
      specifiedPlugins: [testPlugin],
      defaultPlugins: [],
    }));

    const p = await buildProjectGraphAndSourceMapsWithoutDaemon();
    expect(testPlugin.createNodes[1]).toHaveBeenCalled();
  });

  it('should not throw an error if sane plugins are used and called in parallel', () => {
    const testPlugin = {
      name: 'test-plugin',
      createNodes: [
        '*',
        vi.fn().mockImplementation(async () => {
          return [];
        }),
      ],
    } as any;
    vi.spyOn(plugins, 'getPluginsSeparated').mockImplementation(async () => ({
      specifiedPlugins: [testPlugin],
      defaultPlugins: [],
    }));

    return Promise.all([
      buildProjectGraphAndSourceMapsWithoutDaemon(),
      buildProjectGraphAndSourceMapsWithoutDaemon(),
      buildProjectGraphAndSourceMapsWithoutDaemon(),
    ]).then(() => {
      expect(testPlugin.createNodes[1]).toHaveBeenCalledTimes(3);
    });
  });
});

describe('handleProjectGraphError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.NX_VERBOSE_LOGGING;
  });

  function throwGraphError() {
    const errorSpy = vi.spyOn(output, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const metadataError = new CreateMetadataError(
      new Error('cause message'),
      'test-plugin'
    );
    handleProjectGraphError(
      { exitOnError: true },
      new ProjectGraphError(
        [metadataError],
        { nodes: {}, dependencies: {} },
        {}
      )
    );
    return errorSpy.mock.calls[0][0];
  }

  it('should display the underlying error messages when not verbose', () => {
    const { bodyLines } = throwGraphError();
    const body = bodyLines.join('\n');
    expect(body).toContain('cause message');
    expect(body).toContain('test-plugin');
    expect(body).toContain('Pass --verbose to see the stacktraces.');
    expect(body).not.toMatch(/\s+at.*project-graph.spec.ts/);
  });

  it('should display the stacktraces when verbose', () => {
    process.env.NX_VERBOSE_LOGGING = 'true';
    const { bodyLines } = throwGraphError();
    const body = bodyLines.join('\n');
    expect(body).toContain('cause message');
    expect(body).toMatch(/\s+at.*project-graph.spec.ts/);
  });
});
