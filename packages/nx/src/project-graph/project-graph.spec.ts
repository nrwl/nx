// The global jest setup (`scripts/unit-test-setup.js`) mocks
// `nx/src/project-graph/project-graph` to return an empty graph for every
// test, but this suite is the one place that exercises the real
// `buildProjectGraphAndSourceMapsWithoutDaemon` implementation, so opt out.
jest.unmock('./project-graph');

import {
  buildProjectGraphAndSourceMapsWithoutDaemon,
  handleProjectGraphError,
} from './project-graph';
import { AggregateCreateNodesError, ProjectGraphError } from './error-types';
import { output } from '../utils/output';
import * as plugins from './plugins/get-plugins';

jest.mock('../utils/workspace-context', () => {
  return {
    globWithWorkspaceContext: jest.fn().mockReturnValue(['file']),
    // multiGlob returns one file list per glob group (string[][]).
    multiGlobWithWorkspaceContext: jest.fn().mockReturnValue([['file']]),
    getNxWorkspaceFilesFromContext: jest.fn().mockReturnValue({
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
        jest.fn().mockImplementation(async () => {
          const graph = await buildProjectGraphAndSourceMapsWithoutDaemon();
          return [];
        }),
      ],
    } as any;

    jest.spyOn(plugins, 'getPluginsSeparated').mockImplementation(async () => ({
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
        jest.fn().mockImplementation(async () => {
          if (!global.NX_GRAPH_CREATION) {
            const graph = await buildProjectGraphAndSourceMapsWithoutDaemon();
          }
          return [];
        }),
      ],
    } as any;
    jest.spyOn(plugins, 'getPluginsSeparated').mockImplementation(async () => ({
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
        jest.fn().mockImplementation(async () => {
          return [];
        }),
      ],
    } as any;
    jest.spyOn(plugins, 'getPluginsSeparated').mockImplementation(async () => ({
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
    jest.restoreAllMocks();
    delete process.env.NX_VERBOSE_LOGGING;
  });

  it('should print the nested error messages without --verbose', () => {
    const outputErrorSpy = jest
      .spyOn(output, 'error')
      .mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit');
    }) as any);

    const aggregateError = new AggregateCreateNodesError(
      [
        [
          'packages/app/package.json',
          new Error(
            'Invalid workspace dependency alias "alias-name": "workspace:@acme/missing-lib@*".'
          ),
        ],
      ],
      []
    );
    const projectGraphError = new ProjectGraphError(
      [aggregateError],
      { nodes: {}, dependencies: {} } as any,
      {}
    );

    expect(() =>
      handleProjectGraphError({ exitOnError: true }, projectGraphError)
    ).toThrow('exit');

    expect(outputErrorSpy).toHaveBeenCalledWith({
      title: projectGraphError.message,
      bodyLines: [aggregateError.message],
    });
    // the regression this pins: non-verbose output used to hide the nested
    // messages behind a "Pass --verbose" hint
    expect(outputErrorSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        bodyLines: expect.arrayContaining([
          expect.stringContaining('Pass --verbose'),
        ]),
      })
    );
  });

  it('should print the stacks with --verbose', () => {
    process.env.NX_VERBOSE_LOGGING = 'true';
    const outputErrorSpy = jest
      .spyOn(output, 'error')
      .mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit');
    }) as any);

    const projectGraphError = new ProjectGraphError(
      [
        new AggregateCreateNodesError(
          [['package.json', new Error('boom')]],
          []
        ),
      ],
      { nodes: {}, dependencies: {} } as any,
      {}
    );

    expect(() =>
      handleProjectGraphError({ exitOnError: true }, projectGraphError)
    ).toThrow('exit');

    expect(outputErrorSpy).toHaveBeenCalledWith({
      title: projectGraphError.message,
      bodyLines: [projectGraphError.stack],
    });
  });
});
