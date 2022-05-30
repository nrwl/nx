import { ProjectGraph } from '../config/project-graph';
import { createTaskGraph } from 'nx/src/tasks-runner/create-task-graph';

describe('createTaskGraph', () => {
  let projectGraph: ProjectGraph;
  beforeEach(() => {
    projectGraph = {
      nodes: {
        app1: {
          name: 'app1',
          type: 'app',
          data: {
            root: 'app1-root',
            files: [],
            targets: {
              prebuild: {},
              build: {
                dependsOn: [
                  {
                    projects: 'dependencies',
                    target: 'build',
                  },
                  {
                    projects: 'self',
                    target: 'prebuild',
                  },
                ],
              },
              test: {},
              serve: {},
            },
          },
        },
        lib1: {
          name: 'lib1',
          type: 'lib',
          data: {
            root: 'lib1-root',
            files: [],
            targets: {
              build: {},
              test: {},
            },
          },
        },
      },
      dependencies: {
        app1: [{ source: 'app1', target: 'lib1', type: 'static' }],
        lib1: [],
      },
    };
  });

  it('should return an empty task for an empty project graph', () => {
    const tasks = createTaskGraph(
      { nodes: {}, dependencies: {} },
      {},
      [],
      ['test'],
      'development',
      {}
    );

    expect(tasks).toEqual({
      roots: [],
      tasks: {},
      dependencies: {},
    });
  });

  it('should return a task per project with the given target', () => {
    const oneTask = createTaskGraph(
      projectGraph,
      {},
      ['app1'],
      ['test'],
      'development',
      {
        a: 123,
      }
    );
    expect(oneTask).toEqual({
      roots: ['app1:test'],
      tasks: {
        'app1:test': {
          id: 'app1:test',
          target: {
            project: 'app1',
            target: 'test',
          },
          overrides: { a: 123 },
          projectRoot: 'app1-root',
        },
      },
      dependencies: {
        'app1:test': [],
      },
    });

    const twoTasks = createTaskGraph(
      projectGraph,
      {},
      ['app1', 'lib1'],
      ['test'],
      'development',
      {
        a: 123,
      }
    );

    expect(twoTasks).toEqual({
      roots: ['app1:test', 'lib1:test'],
      tasks: {
        'app1:test': {
          id: 'app1:test',
          target: {
            project: 'app1',
            target: 'test',
          },
          overrides: { a: 123 },
          projectRoot: 'app1-root',
        },
        'lib1:test': {
          id: 'lib1:test',
          target: {
            project: 'lib1',
            target: 'test',
          },
          overrides: { a: 123 },
          projectRoot: 'lib1-root',
        },
      },
      dependencies: {
        'app1:test': [],
        'lib1:test': [],
      },
    });
  });

  it('should interpolate overrides', () => {
    const oneTask = createTaskGraph(
      projectGraph,
      {},
      ['app1'],
      ['test'],
      'development',
      {
        a: '--value={project.root}',
      }
    );
    expect(oneTask).toEqual({
      roots: ['app1:test'],
      tasks: {
        'app1:test': {
          id: 'app1:test',
          target: {
            project: 'app1',
            target: 'test',
          },
          overrides: { a: '--value=app1-root' },
          projectRoot: 'app1-root',
        },
      },
      dependencies: {
        'app1:test': [],
      },
    });
  });

  it('should create graphs with dependencies', () => {
    const taskGraph = createTaskGraph(
      projectGraph,
      {},
      ['app1'],
      ['build'],
      'development',
      {}
    );
    // prebuild should also be in here
    expect(taskGraph).toEqual({
      roots: ['lib1:build', 'app1:prebuild'],
      tasks: {
        'app1:build': {
          id: 'app1:build',
          target: {
            project: 'app1',
            target: 'build',
          },
          overrides: {},
          projectRoot: 'app1-root',
        },
        'app1:prebuild': {
          id: 'app1:prebuild',
          target: {
            project: 'app1',
            target: 'prebuild',
          },
          overrides: {},
          projectRoot: 'app1-root',
        },
        'lib1:build': {
          id: 'lib1:build',
          target: {
            project: 'lib1',
            target: 'build',
          },
          overrides: {},
          projectRoot: 'lib1-root',
        },
      },
      dependencies: {
        'app1:build': ['lib1:build', 'app1:prebuild'],
        'app1:prebuild': [],
        'lib1:build': [],
      },
    });
  });

  it('should handle diamond shape dependencies', () => {
    projectGraph = {
      nodes: {
        app1: {
          name: 'app1',
          type: 'app',
          data: {
            root: 'app1-root',
            files: [],
            targets: {
              build: {},
            },
          },
        },
        lib1: {
          name: 'lib1',
          type: 'lib',
          data: {
            root: 'lib1-root',
            files: [],
            targets: {
              build: {},
            },
          },
        },
        lib2: {
          name: 'lib2',
          type: 'lib',
          data: {
            root: 'lib2-root',
            files: [],
            targets: {
              build: {},
            },
          },
        },
        lib3: {
          name: 'lib3',
          type: 'lib',
          data: {
            root: 'lib3-root',
            files: [],
            targets: {
              build: {},
            },
          },
        },
      },
      dependencies: {
        app1: [
          { source: 'app1', target: 'lib1', type: 'static' },
          { source: 'app1', target: 'lib2', type: 'static' },
        ],
        lib1: [{ source: 'lib1', target: 'lib3', type: 'static' }],
        lib2: [{ source: 'lib2', target: 'lib3', type: 'static' }],
        lib3: [],
      },
    };

    const taskGraph = createTaskGraph(
      projectGraph,
      {
        build: [
          {
            projects: 'dependencies',
            target: 'build',
          },
        ],
      },
      ['app1'],
      ['build'],
      'development',
      {}
    );
    // prebuild should also be in here
    expect(taskGraph).toEqual({
      roots: ['lib3:build'],
      tasks: {
        'app1:build': {
          id: 'app1:build',
          target: {
            project: 'app1',
            target: 'build',
          },
          overrides: {},
          projectRoot: 'app1-root',
        },
        'lib1:build': {
          id: 'lib1:build',
          target: {
            project: 'lib1',
            target: 'build',
          },
          overrides: {},
          projectRoot: 'lib1-root',
        },
        'lib2:build': {
          id: 'lib2:build',
          target: {
            project: 'lib2',
            target: 'build',
          },
          overrides: {},
          projectRoot: 'lib2-root',
        },
        'lib3:build': {
          id: 'lib3:build',
          target: {
            project: 'lib3',
            target: 'build',
          },
          overrides: {},
          projectRoot: 'lib3-root',
        },
      },
      dependencies: {
        'app1:build': ['lib1:build', 'lib2:build'],
        'lib1:build': ['lib3:build'],
        'lib2:build': ['lib3:build'],
        'lib3:build': [],
      },
    });
  });

  it('should handle cycles within the same project', () => {
    projectGraph = {
      nodes: {
        app1: {
          name: 'app1',
          type: 'app',
          data: {
            root: 'app1-root',
            files: [],
            targets: {
              build: {
                dependsOn: [{ target: 'test', projects: 'self' }],
              },
              test: {
                dependsOn: [{ target: 'build', projects: 'self' }],
              },
            },
          },
        },
      },
      dependencies: {},
    };

    const taskGraph = createTaskGraph(
      projectGraph,
      {},
      ['app1'],
      ['build'],
      'development',
      {}
    );
    // prebuild should also be in here
    expect(taskGraph).toEqual({
      roots: [],
      tasks: {
        'app1:build': {
          id: 'app1:build',
          target: {
            project: 'app1',
            target: 'build',
          },
          overrides: {},
          projectRoot: 'app1-root',
        },
        'app1:test': {
          id: 'app1:test',
          target: {
            project: 'app1',
            target: 'test',
          },
          overrides: {},
          projectRoot: 'app1-root',
        },
      },
      dependencies: {
        'app1:build': ['app1:test'],
        'app1:test': ['app1:build'],
      },
    });
  });

  it('should handle cycles between projects (app1:build <-> app2 <-> app3:build)', () => {
    projectGraph = {
      nodes: {
        app1: {
          name: 'app1',
          type: 'app',
          data: {
            root: 'app1-root',
            files: [],
            targets: {
              build: {},
            },
          },
        },
        app2: {
          name: 'app2',
          type: 'app',
          data: {
            root: 'app2-root',
            files: [],
            targets: {},
          },
        },
        app3: {
          name: 'app3',
          type: 'app',
          data: {
            root: 'app3-root',
            files: [],
            targets: {
              build: {},
            },
          },
        },
      },
      dependencies: {
        app1: [{ source: 'app1', target: 'app2', type: 'static' }],
        app2: [
          { source: 'app2', target: 'app1', type: 'static' },
          { source: 'app2', target: 'app3', type: 'static' },
        ],
        app3: [{ source: 'app3', target: 'app2', type: 'static' }],
      },
    };

    const taskGraph = createTaskGraph(
      projectGraph,
      {
        build: [{ target: 'build', projects: 'dependencies' }],
      },
      ['app1'],
      ['build'],
      'development',
      {}
    );
    expect(taskGraph).toEqual({
      roots: [],
      tasks: {
        'app1:build': {
          id: 'app1:build',
          target: {
            project: 'app1',
            target: 'build',
          },
          overrides: {},
          projectRoot: 'app1-root',
        },
        'app3:build': {
          id: 'app3:build',
          target: {
            project: 'app3',
            target: 'build',
          },
          overrides: {},
          projectRoot: 'app3-root',
        },
      },
      dependencies: {
        'app1:build': ['app3:build'],
        'app3:build': ['app1:build'],
      },
    });
  });

  it('should handle cycles between projects that do not create cycles between tasks (app1:build -> app2 <-> app3:build)``', () => {
    projectGraph = {
      nodes: {
        app1: {
          name: 'app1',
          type: 'app',
          data: {
            root: 'app1-root',
            files: [],
            targets: {
              build: {},
            },
          },
        },
        app2: {
          name: 'app2',
          type: 'app',
          data: {
            root: 'app2-root',
            files: [],
            targets: {},
          },
        },
        app3: {
          name: 'app3',
          type: 'app',
          data: {
            root: 'app3-root',
            files: [],
            targets: {
              build: {},
            },
          },
        },
      },
      dependencies: {
        app1: [{ source: 'app1', target: 'app2', type: 'static' }],
        app2: [{ source: 'app2', target: 'app3', type: 'static' }],
        app3: [{ source: 'app3', target: 'app2', type: 'static' }],
      },
    };

    const taskGraph = createTaskGraph(
      projectGraph,
      {
        build: [{ target: 'build', projects: 'dependencies' }],
      },
      ['app1'],
      ['build'],
      'development',
      {}
    );
    expect(taskGraph).toEqual({
      roots: ['app3:build'],
      tasks: {
        'app1:build': {
          id: 'app1:build',
          target: {
            project: 'app1',
            target: 'build',
          },
          overrides: {},
          projectRoot: 'app1-root',
        },
        'app3:build': {
          id: 'app3:build',
          target: {
            project: 'app3',
            target: 'build',
          },
          overrides: {},
          projectRoot: 'app3-root',
        },
      },
      dependencies: {
        'app1:build': ['app3:build'],
        'app3:build': [],
      },
    });
  });
});
