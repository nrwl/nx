import type {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import type { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { showProjectHandler } from './project';
import * as workspaceRoot from '../../utils/workspace-root';

let graph: ProjectGraph = {
  nodes: {},
  dependencies: {},
  externalNodes: {},
};

let mockCwd = '/workspace';

jest.mock('../../project-graph/project-graph', () => ({
  ...(jest.requireActual(
    '../../project-graph/project-graph'
  ) as typeof import('../../project-graph/project-graph')),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(() => Promise.resolve(graph)),
}));

jest.mock('../../utils/workspace-root', () => ({
  workspaceRoot: '/workspace',
}));

jest.mock('../../utils/output', () => ({
  output: {
    error: jest.fn(),
    drain: jest.fn().mockResolvedValue(undefined),
  },
}));

const originalCwd = process.cwd;

performance.mark = jest.fn();
performance.measure = jest.fn();

describe('show project', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    performance.mark('init-local');
    mockCwd = '/workspace';
    process.cwd = jest.fn().mockReturnValue(mockCwd);
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.cwd = originalCwd;
  });

  it('should show project when projectName is provided', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: { executor: '@nx/web:build' },
            test: { executor: '@nx/jest:jest' },
          },
        },
        'app'
      )
      .build();

    await showProjectHandler({
      projectName: 'my-app',
      json: true,
    });

    expect(console.log).toHaveBeenCalledWith(
      JSON.stringify(graph.nodes['my-app'].data)
    );
  });

  it('should infer project from cwd when no projectName is provided', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: { executor: '@nx/web:build' },
          },
        },
        'app'
      )
      .addProjectConfiguration(
        {
          root: 'libs/my-lib',
          name: 'my-lib',
          targets: {
            build: { executor: '@nx/js:tsc' },
          },
        },
        'lib'
      )
      .build();

    // Simulate being in the my-app directory
    process.cwd = jest.fn().mockReturnValue('/workspace/apps/my-app');

    await showProjectHandler({
      json: true,
    });

    expect(console.log).toHaveBeenCalledWith(
      JSON.stringify(graph.nodes['my-app'].data)
    );
  });

  it('should infer project from nested subdirectory in cwd', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
          targets: {
            build: { executor: '@nx/web:build' },
          },
        },
        'app'
      )
      .build();

    // Simulate being in a subdirectory of my-app
    process.cwd = jest.fn().mockReturnValue('/workspace/apps/my-app/src/lib');

    await showProjectHandler({
      json: true,
    });

    expect(console.log).toHaveBeenCalledWith(
      JSON.stringify(graph.nodes['my-app'].data)
    );
  });

  it('should show error when cwd is not within a project and no projectName provided', async () => {
    const { output } = require('../../utils/output');

    // Make process.exit throw to stop execution
    jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit: ${code}`);
    });

    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'apps/my-app',
          name: 'my-app',
        },
        'app'
      )
      .build();

    // Simulate being at workspace root (not in any project)
    process.cwd = jest.fn().mockReturnValue('/workspace');

    await expect(
      showProjectHandler({
        json: true,
      })
    ).rejects.toThrow('process.exit: 1');

    expect(output.error).toHaveBeenCalledWith({
      title: 'Could not find a project in the current working directory.',
      bodyLines: expect.arrayContaining([
        expect.stringContaining('nx show project'),
      ]),
    });
  });

  it('should handle project at workspace root', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: '.',
          name: 'root-project',
          targets: {
            build: { executor: '@nx/web:build' },
          },
        },
        'app'
      )
      .build();

    // Simulate being at workspace root
    process.cwd = jest.fn().mockReturnValue('/workspace');

    await showProjectHandler({
      json: true,
    });

    expect(console.log).toHaveBeenCalledWith(
      JSON.stringify(graph.nodes['root-project'].data)
    );
  });
});

class GraphBuilder {
  nodes: Record<string, ProjectGraphProjectNode> = {};

  addProjectConfiguration(
    project: ProjectConfiguration,
    type: ProjectGraph['nodes'][string]['type']
  ) {
    this.nodes[project.name] = {
      name: project.name,
      type,
      data: { ...project },
    };
    return this;
  }

  build(): ProjectGraph {
    return {
      nodes: this.nodes,
      dependencies: {},
      externalNodes: {},
    };
  }
}
