import { ProjectGraph } from '@nrwl/devkit';

const mockProjectGraph: ProjectGraph = {
  nodes: {
    proj: {
      type: 'library',
      name: 'proj',
      data: {},
    },
  },
  dependencies: {
    proj: [],
  },
};

jest.mock('../../project-graph', () => {
  return {
    createProjectGraph() {
      return mockProjectGraph;
    },
  };
});

// Mock out file watcher logic so that the tests don't hang
const mockSubscribeToWorkspaceChanges = jest.fn();
jest.mock('./watcher', () => {
  return {
    subscribeToWorkspaceChanges: mockSubscribeToWorkspaceChanges,
  };
});

import { startServer, stopServer } from './server';

import { getProjectGraphFromServer, isServerAvailable } from '../client/client';

import { killSocketOrPath } from '../socket-utils';

describe('Daemon Server', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    killSocketOrPath();
  });

  it('should be startable and stoppable', async () => {
    const server = await startServer({});
    expect(server.listening).toBe(true);

    await stopServer();
    expect(server.listening).toBe(false);
  });

  it('should invoke the file watcher subscription logic upon start up', async () => {
    expect(mockSubscribeToWorkspaceChanges).not.toHaveBeenCalled();
    await startServer({});
    expect(mockSubscribeToWorkspaceChanges).toHaveBeenCalledTimes(1);
    await stopServer();
  });

  it('should error if the server is started multiple times', async () => {
    await startServer({});
    await expect(startServer({})).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Listen method has been called more than once without closing."`
    );
    // Stop the running server so that the async jest test can complete
    await stopServer();
  });

  describe('isServerAvailable()', () => {
    it('should return true if the daemon server is available for connections', async () => {
      expect(await isServerAvailable()).toBe(false);

      await startServer({});
      expect(await isServerAvailable()).toBe(true);

      await stopServer();
      expect(await isServerAvailable()).toBe(false);
    });
  });

  describe('getProjectGraphFromServer()', () => {
    it('should error if the server is not running', async () => {
      await expect(getProjectGraphFromServer()).rejects.toThrowError(
        'Error: The Daemon Server is not running'
      );
    });

    xit(`should return a Promise of the workspace's ProjectGraph from the server`, async () => {
      await startServer({});

      const projectGraph = await getProjectGraphFromServer();
      expect(projectGraph).toStrictEqual(mockProjectGraph);

      await stopServer();
    });
  });
});
