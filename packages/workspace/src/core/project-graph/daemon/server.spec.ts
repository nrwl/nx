import { ProjectGraph } from '@nrwl/devkit';
import {
  getProjectGraphFromServer,
  isServerAvailable,
  killSocketOrPath,
  startServer,
  stopServer,
} from './server';

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
  allWorkspaceFiles: [
    {
      file: 'proj/main.ts',
      hash: 'abc123',
      ext: '.ts',
    },
  ],
};

jest.mock('../project-graph', () => {
  return {
    createProjectGraph() {
      return mockProjectGraph;
    },
  };
});

describe('Daemon Server', () => {
  afterEach(() => {
    killSocketOrPath();
  });

  it('should be startable and stoppable', async () => {
    const server = await startServer({});
    expect(server.listening).toBe(true);

    await stopServer();
    expect(server.listening).toBe(false);
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
      expect(isServerAvailable()).toBe(false);

      await startServer({});
      expect(isServerAvailable()).toBe(true);

      await stopServer();
      expect(isServerAvailable()).toBe(false);
    });
  });

  describe('getProjectGraphFromServer()', () => {
    it('should error if the server is not running', async () => {
      await expect(getProjectGraphFromServer()).rejects.toThrowError(
        'Error: The Daemon Server is not running'
      );
    });

    it(`should return a Promise of the workspace's ProjectGraph from the server`, async () => {
      await startServer({});

      const projectGraph = await getProjectGraphFromServer();
      expect(projectGraph).toStrictEqual(mockProjectGraph);

      await stopServer();
    });
  });
});
