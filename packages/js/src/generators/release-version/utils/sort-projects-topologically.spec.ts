import { sortProjectsTopologically } from './sort-projects-topologically';

describe('sortProjectsTopologically', () => {
  it('should return empty array if no projects are provided', () => {
    const projectGraph = {
      dependencies: {},
      nodes: {},
    };
    const projectNodes = [];
    const result = sortProjectsTopologically(projectGraph, projectNodes);
    expect(result).toEqual([]);
  });

  it('should return a single project if only one project is provided', () => {
    const projectGraph = {
      dependencies: {},
      nodes: {
        project1: {
          name: 'project1',
          data: {
            root: '',
          },
          type: 'app' as const,
        },
      },
    };
    const projectNodes = [projectGraph.nodes.project1];
    const result = sortProjectsTopologically(projectGraph, projectNodes);
    expect(result).toEqual([projectGraph.nodes.project1]);
  });

  it('should return projects in the correct order', () => {
    const projectGraph = {
      dependencies: {
        project1: [
          {
            source: 'project1',
            target: 'project2',
            type: 'static',
          },
        ],
        project2: [],
      },
      nodes: {
        project1: {
          name: 'project1',
          data: {
            root: '',
          },
          type: 'app' as const,
        },
        project2: {
          name: 'project2',
          data: {
            root: '',
          },
          type: 'app' as const,
        },
      },
    };
    const projectNodes = [
      projectGraph.nodes.project1,
      projectGraph.nodes.project2,
    ];
    const result = sortProjectsTopologically(projectGraph, projectNodes);
    expect(result).toEqual([
      projectGraph.nodes.project2,
      projectGraph.nodes.project1,
    ]);
  });

  it('should return the original list of nodes if a circular dependency is present', () => {
    const projectGraph = {
      dependencies: {
        project1: [
          {
            source: 'project1',
            target: 'project2',
            type: 'static',
          },
        ],
        project2: [
          {
            source: 'project2',
            target: 'project1',
            type: 'static',
          },
        ],
      },
      nodes: {
        project1: {
          name: 'project1',
          data: {
            root: '',
          },
          type: 'app' as const,
        },
        project2: {
          name: 'project2',
          data: {
            root: '',
          },
          type: 'app' as const,
        },
      },
    };
    const projectNodes = [
      projectGraph.nodes.project1,
      projectGraph.nodes.project2,
    ];
    const result = sortProjectsTopologically(projectGraph, projectNodes);
    expect(result).toEqual(projectNodes);
  });
});
