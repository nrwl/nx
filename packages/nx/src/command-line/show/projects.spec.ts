import type {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import type { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { filterAffected } from '../../project-graph/affected/affected-project-graph';
import { hasCustomHasher } from './show-target/utils';
import { showProjectsHandler } from './projects';

let graph: ProjectGraph = {
  nodes: {},
  dependencies: {},
  externalNodes: {},
};
let affectedProjects: string[] | undefined;

jest.mock('../../config/nx-json', () => ({
  ...(jest.requireActual(
    '../../config/nx-json'
  ) as typeof import('../../config/nx-json')),
  readNxJson: jest.fn(() => ({})),
}));
jest.mock('../../project-graph/project-graph', () => ({
  ...(jest.requireActual(
    '../../project-graph/project-graph'
  ) as typeof import('../../project-graph/project-graph')),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(() => Promise.resolve(graph)),
}));
jest.mock('../../project-graph/affected/affected-project-graph', () => ({
  filterAffected: jest.fn((projectGraph: ProjectGraph) => ({
    ...projectGraph,
    nodes: Object.fromEntries(
      Object.entries(projectGraph.nodes).filter(
        ([name]) => !affectedProjects || affectedProjects.includes(name)
      )
    ),
  })),
}));
jest.mock('./show-target/utils', () => ({
  hasCustomHasher: jest.fn(() => false),
}));

performance.mark = jest.fn();
performance.measure = jest.fn();

describe('show projects', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    performance.mark('init-local');
    affectedProjects = undefined;
    (hasCustomHasher as jest.Mock).mockReturnValue(false);
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

  it('preserves affected and target behavior without input filtering', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration({
        root: 'proj1',
        name: 'proj1',
        targets: {
          build: { inputs: ['{projectRoot}/src/**/*'] },
        },
      })
      .addProjectConfiguration({
        root: 'proj2',
        name: 'proj2',
        targets: {
          build: { inputs: ['{projectRoot}/src/**/*'] },
        },
      })
      .build();

    await showProjectsHandler({
      affected: true,
      withTarget: ['build'],
      files: ['unrelated.txt'],
      json: true,
    });

    expect(filterAffected).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith('["proj1","proj2"]');
  });

  it('narrows affected projects using target inputs', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration({
        root: 'proj1',
        name: 'proj1',
        targets: {
          build: { inputs: ['{projectRoot}/src/**/*'] },
        },
      })
      .addProjectConfiguration({
        root: 'proj2',
        name: 'proj2',
        targets: {
          build: { inputs: ['{projectRoot}/src/**/*'] },
        },
      })
      .build();

    await showProjectsHandler({
      affected: true,
      withTarget: ['build'],
      filterByTaskInputs: true,
      files: ['proj1/src/main.ts'],
      json: true,
    });

    expect(console.log).toHaveBeenCalledWith('["proj1"]');
  });

  it('uses OR semantics when filtering multiple targets', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration({
        root: 'proj1',
        name: 'proj1',
        targets: {
          build: { inputs: ['{projectRoot}/src/**/*'] },
          test: { inputs: ['{projectRoot}/test/**/*'] },
        },
      })
      .addProjectConfiguration({
        root: 'proj2',
        name: 'proj2',
        targets: {
          build: { inputs: ['{projectRoot}/src/**/*'] },
          test: { inputs: ['{projectRoot}/test/**/*'] },
        },
      })
      .build();

    await showProjectsHandler({
      affected: true,
      withTarget: ['build', 'test'],
      filterByTaskInputs: true,
      files: ['proj1/test/example.spec.ts'],
      json: true,
    });

    expect(console.log).toHaveBeenCalledWith('["proj1"]');
  });

  it('uses the full project graph to resolve target inputs', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration({
        root: 'app',
        name: 'app',
        targets: {
          build: { inputs: [{ input: 'schema', projects: ['schema'] }] },
        },
      })
      .addProjectConfiguration({
        root: 'schema',
        name: 'schema',
        namedInputs: { schema: ['{projectRoot}/**/*.json'] },
      })
      .build();
    affectedProjects = ['app'];

    await showProjectsHandler({
      affected: true,
      withTarget: ['build'],
      filterByTaskInputs: true,
      files: ['schema/model.json'],
      json: true,
    });

    expect(console.log).toHaveBeenCalledWith('["app"]');
  });

  it('rejects direct handler calls without required options', async () => {
    await expect(
      showProjectsHandler({ filterByTaskInputs: true, withTarget: ['build'] })
    ).rejects.toThrow('--filter-by-task-inputs requires --affected.');
    await expect(
      showProjectsHandler({ filterByTaskInputs: true, affected: true })
    ).rejects.toThrow('--filter-by-task-inputs requires --with-target.');
  });

  it('conservatively retains targets with custom hashers', async () => {
    graph = new GraphBuilder()
      .addProjectConfiguration({
        root: 'proj1',
        name: 'proj1',
        targets: {
          build: { inputs: ['{projectRoot}/src/**/*'] },
        },
      })
      .build();
    (hasCustomHasher as jest.Mock).mockReturnValue(true);

    await showProjectsHandler({
      affected: true,
      withTarget: ['build'],
      filterByTaskInputs: true,
      files: ['unrelated.txt'],
      json: true,
    });

    expect(console.log).toHaveBeenCalledWith('["proj1"]');
  });
});

class GraphBuilder {
  nodes: Record<string, ProjectGraphProjectNode> = {};

  addProjectConfiguration(
    project: ProjectConfiguration,
    type: ProjectGraph['nodes'][string]['type'] = 'lib'
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
