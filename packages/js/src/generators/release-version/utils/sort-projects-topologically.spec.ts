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

  it('should return [2,1] if 1 depends on 2', () => {
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

  it('should return [3,2,1] if 1 depends on 2 and 2 depends on 3', () => {
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
            target: 'project3',
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
        project3: {
          name: 'project3',
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
      projectGraph.nodes.project3,
    ];
    const result = sortProjectsTopologically(projectGraph, projectNodes);
    expect(result).toEqual([
      projectGraph.nodes.project3,
      projectGraph.nodes.project2,
      projectGraph.nodes.project1,
    ]);
  });

  it('should return [1,2,3,4] if 1 has zero dependencies, 2 has one, 3 has two, and 4 has three', () => {
    const projectGraph = {
      dependencies: {
        project1: [],
        project2: [
          {
            source: 'project2',
            target: 'project1',
            type: 'static',
          },
        ],
        project3: [
          {
            source: 'project3',
            target: 'project1',
            type: 'static',
          },
          {
            source: 'project3',
            target: 'project2',
            type: 'static',
          },
        ],
        project4: [
          {
            source: 'project4',
            target: 'project3',
            type: 'static',
          },
          {
            source: 'project4',
            target: 'project2',
            type: 'static',
          },
          {
            source: 'project4',
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
        project3: {
          name: 'project3',
          data: {
            root: '',
          },
          type: 'app' as const,
        },
        project4: {
          name: 'project4',
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
      projectGraph.nodes.project3,
      projectGraph.nodes.project4,
    ];
    const result = sortProjectsTopologically(projectGraph, projectNodes);
    expect(result).toEqual([
      projectGraph.nodes.project1,
      projectGraph.nodes.project2,
      projectGraph.nodes.project3,
      projectGraph.nodes.project4,
    ]);
  });
});
