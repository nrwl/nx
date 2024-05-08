import type {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import type { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { showProjectsHandler } from './projects';

let graph: ProjectGraph = {
  nodes: {},
  dependencies: {},
  externalNodes: {},
};

jest.mock('../../project-graph/project-graph', () => ({
  ...(jest.requireActual(
    '../../project-graph/project-graph'
  ) as typeof import('../../project-graph/project-graph')),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(() => Promise.resolve(graph)),
}));

describe('show projects', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should print out projects with provided seperator value', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'proj1',
          name: 'proj1',
        },
        'app'
      )
      .addProjectConfiguration(
        {
          root: 'proj2',
          name: 'proj2',
        },
        'lib'
      )
      .addProjectConfiguration(
        {
          root: 'proj3',
          name: 'proj3',
        },
        'lib'
      )
      .build();

    await showProjectsHandler({
      sep: ',',
    });

    expect(console.log).toHaveBeenCalledWith('proj1,proj2,proj3');
  });

  it('should default to printing one project per line', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'proj1',
          name: 'proj1',
        },
        'app'
      )
      .addProjectConfiguration(
        {
          root: 'proj2',
          name: 'proj2',
        },
        'lib'
      )
      .addProjectConfiguration(
        {
          root: 'proj3',
          name: 'proj3',
        },
        'lib'
      )
      .build();

    await showProjectsHandler({});

    expect(console.log).toHaveBeenCalledWith('proj1');
    expect(console.log).toHaveBeenCalledWith('proj2');
    expect(console.log).toHaveBeenCalledWith('proj3');
    expect(console.log).toHaveBeenCalledTimes(3);
  });

  it('should print out projects in json format', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'proj1',
          name: 'proj1',
        },
        'app'
      )
      .addProjectConfiguration(
        {
          root: 'proj2',
          name: 'proj2',
        },
        'lib'
      )
      .addProjectConfiguration(
        {
          root: 'proj3',
          name: 'proj3',
        },
        'lib'
      )
      .build();

    await showProjectsHandler({
      json: true,
    });

    expect(console.log).toHaveBeenCalledWith('["proj1","proj2","proj3"]');
  });

  it('should filter projects by type', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'proj1',
          name: 'proj1',
        },
        'app'
      )
      .addProjectConfiguration(
        {
          root: 'proj2',
          name: 'proj2',
        },
        'lib'
      )
      .addProjectConfiguration(
        {
          root: 'proj3',
          name: 'proj3',
        },
        'lib'
      )
      .build();

    await showProjectsHandler({
      type: 'lib',
    });

    expect(console.log).toHaveBeenCalledWith('proj2');
    expect(console.log).toHaveBeenCalledWith('proj3');
    expect(console.log).toHaveBeenCalledTimes(2);
  });

  it('should filter projects by name', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'proj1',
          name: 'proj1',
        },
        'app'
      )
      .addProjectConfiguration(
        {
          root: 'proj2',
          name: 'proj2',
        },
        'lib'
      )
      .addProjectConfiguration(
        {
          root: 'proj3',
          name: 'proj3',
        },
        'lib'
      )
      .build();

    await showProjectsHandler({
      projects: ['proj1', 'proj3'],
    });

    expect(console.log).toHaveBeenCalledWith('proj1');
    expect(console.log).toHaveBeenCalledWith('proj3');
    expect(console.log).toHaveBeenCalledTimes(2);
  });

  it('should exclude projects by name', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'proj1',
          name: 'proj1',
        },
        'app'
      )
      .addProjectConfiguration(
        {
          root: 'proj2',
          name: 'proj2',
        },
        'lib'
      )
      .addProjectConfiguration(
        {
          root: 'proj3',
          name: 'proj3',
        },
        'lib'
      )
      .build();

    await showProjectsHandler({
      exclude: ['proj1', 'proj3'],
    });

    expect(console.log).toHaveBeenCalledWith('proj2');
    expect(console.log).toHaveBeenCalledTimes(1);
  });

  it('should find projects with wildcard', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'proj1',
          name: 'proj1',
        },
        'app'
      )
      .addProjectConfiguration(
        {
          root: 'proj2',
          name: 'proj2',
        },
        'lib'
      )
      .addProjectConfiguration(
        {
          root: 'proj3',
          name: 'proj3',
        },
        'lib'
      )
      .build();

    await showProjectsHandler({
      projects: ['*1'],
    });

    expect(console.log).toHaveBeenCalledWith('proj1');
    expect(console.log).toHaveBeenCalledTimes(1);
  });

  it('should find projects with specific tag', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'proj1',
          name: 'proj1',
          tags: ['tag1'],
        },
        'app'
      )
      .addProjectConfiguration(
        {
          root: 'proj2',
          name: 'proj2',
          tags: ['tag2'],
        },
        'lib'
      )
      .addProjectConfiguration(
        {
          root: 'proj3',
          name: 'proj3',
          tags: ['tag1'],
        },
        'lib'
      )
      .build();

    await showProjectsHandler({
      projects: ['tag:tag1'],
    });

    expect(console.log).toHaveBeenCalledWith('proj1');
    expect(console.log).toHaveBeenCalledWith('proj3');
    expect(console.log).toHaveBeenCalledTimes(2);
  });

  it('should list projects with specific target', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration(
        {
          root: 'proj1',
          name: 'proj1',
          targets: {
            build: {
              executor: 'build',
            },
          },
        },
        'app'
      )
      .addProjectConfiguration(
        {
          root: 'proj2',
          name: 'proj2',
          targets: {
            build: {
              executor: 'build',
            },
          },
        },
        'lib'
      )
      .addProjectConfiguration(
        {
          root: 'proj3',
          name: 'proj3',
          targets: {
            test: {
              executor: 'test',
            },
          },
        },
        'lib'
      )
      .build();

    await showProjectsHandler({
      withTarget: ['build'],
    });

    expect(console.log).toHaveBeenCalledWith('proj1');
    expect(console.log).toHaveBeenCalledWith('proj2');
    expect(console.log).toHaveBeenCalledTimes(2);
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
