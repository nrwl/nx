import { DependencyType, ProjectGraph } from '../config/project-graph';
import { createTaskGraph } from './create-task-graph';

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
            targets: {
              prebuild: {
                executor: 'nx:run-commands',
              },
              prebuild2: {
                executor: 'nx:run-commands',
              },
              build: {
                executor: 'nx:run-commands',
                dependsOn: [
                  {
                    dependencies: true,
                    target: 'build',
                  },
                  {
                    target: 'prebuild',
                  },
                  {
                    projects: 'app1',
                    target: 'prebuild2',
                  },
                ],
              },
              test: {
                executor: 'nx:run-commands',
              },
              serve: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
        lib1: {
          name: 'lib1',
          type: 'lib',
          data: {
            root: 'lib1-root',
            targets: {
              build: {
                executor: 'nx:run-commands',
              },
              test: {
                executor: 'nx:run-commands',
              },
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

  it('should correctly set default configuration', () => {
    const projectGraph = {
      nodes: {
        app1: {
          name: 'app1',
          type: 'app',
          data: {
            root: 'app1-root',
            files: [],
            targets: {
              build: {
                executor: 'my-executor',
                configurations: {
                  ci: {},
                },
                dependsOn: [
                  {
                    dependencies: true,
                    target: 'build',
                  },
                ],
              },
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
              build: {
                executor: 'my-executor',
                configurations: {
                  libDefault: {},
                },
                defaultConfiguration: 'libDefault',
                dependsOn: [
                  {
                    dependencies: true,
                    target: 'build',
                  },
                ],
              },
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
              build: {
                executor: 'my-executor',
                configurations: {
                  ci: {},
                },
              },
            },
          },
        },
      },
      dependencies: {
        app1: [{ source: 'app1', target: 'lib1', type: 'static' }],
        lib1: [{ source: 'lib1', target: 'lib2', type: 'static' }],
        lib2: [],
      },
    } as any;

    const buildLib = createTaskGraph(
      projectGraph,
      {},
      ['lib1'],
      ['build'],
      null,
      {}
    );

    expect(buildLib).toEqual({
      roots: ['lib2:build'],
      tasks: {
        'lib1:build:libDefault': {
          id: 'lib1:build:libDefault',
          target: {
            project: 'lib1',
            target: 'build',
            configuration: 'libDefault',
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
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib2-root',
        },
      },
      dependencies: {
        'lib1:build:libDefault': ['lib2:build'],
        'lib2:build': [],
      },
    });

    const buildApp = createTaskGraph(
      projectGraph,
      {},
      ['app1'],
      ['build'],
      'ci',
      {}
    );

    expect(buildApp).toEqual({
      roots: ['lib2:build:ci'],
      tasks: {
        'app1:build:ci': {
          id: 'app1:build:ci',
          target: {
            project: 'app1',
            target: 'build',
            configuration: 'ci',
          },
          overrides: {},
          projectRoot: 'app1-root',
        },
        'lib1:build:libDefault': {
          id: 'lib1:build:libDefault',
          target: {
            project: 'lib1',
            target: 'build',
            configuration: 'libDefault',
          },
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib1-root',
        },
        'lib2:build:ci': {
          id: 'lib2:build:ci',
          target: {
            project: 'lib2',
            target: 'build',
            configuration: 'ci',
          },
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib2-root',
        },
      },
      dependencies: {
        'app1:build:ci': ['lib1:build:libDefault'],
        'lib1:build:libDefault': ['lib2:build:ci'],
        'lib2:build:ci': [],
      },
    });
  });

  it('should not duplicate dependencies', () => {
    const projectGraph = {
      nodes: {
        app1: {
          name: 'app1',
          type: 'app',
          data: {
            root: 'app1-root',
            files: [],
            targets: {
              build: {
                executor: 'my-executor',
                dependsOn: [
                  {
                    dependencies: true,
                    target: 'build',
                  },
                ],
              },
            },
          },
        },
        lib1: {
          name: 'lib1',
          type: 'lib',
          data: {
            root: 'lib1-root',
            files: [],
            targets: {},
          },
        },
        lib2: {
          name: 'lib2',
          type: 'lib',
          data: {
            root: 'lib2-root',
            files: [],
            targets: {},
          },
        },
        lib3: {
          name: 'lib3',
          type: 'lib',
          data: {
            root: 'lib3-root',
            files: [],
            targets: {
              build: {
                executor: 'my-executor',
              },
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
    } as any;

    const buildApp = createTaskGraph(
      projectGraph,
      {},
      ['app1'],
      ['build'],
      null,
      {}
    );

    expect(buildApp).toEqual({
      dependencies: {
        'app1:build': ['lib3:build'],
        'lib3:build': [],
      },
      roots: ['lib3:build'],
      tasks: {
        'app1:build': {
          id: 'app1:build',
          overrides: {},
          projectRoot: 'app1-root',
          target: {
            project: 'app1',
            target: 'build',
          },
        },
        'lib3:build': {
          id: 'lib3:build',
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib3-root',
          target: {
            project: 'lib3',
            target: 'build',
          },
        },
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

  it('should not interpolate non-existing options and leave those untouched', () => {
    const oneTask = createTaskGraph(
      projectGraph,
      {},
      ['app1'],
      ['test'],
      'development',
      {
        a: '--base-href=/{projectRoot}${deploymentId}',
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
          overrides: { a: '--base-href=/app1-root${deploymentId}' },
          projectRoot: 'app1-root',
        },
      },
      dependencies: {
        'app1:test': [],
      },
    });
  });

  it('should forward args when configured', () => {
    projectGraph = {
      nodes: {
        app1: {
          name: 'app1',
          type: 'app',
          data: {
            root: 'app1-root',
            targets: {
              'prebuild-base': {
                executor: 'nx:run-commands',
              },
              prebuild: {
                executor: 'nx:run-commands',
              },
              build: {
                executor: 'nx:run-commands',
                dependsOn: [
                  {
                    dependencies: true,
                    target: 'build',
                    params: 'forward',
                  },
                  { target: 'prebuild', params: 'forward' },
                ],
              },
              test: {
                executor: 'nx:run-commands',
              },
              serve: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
        lib1: {
          name: 'lib1',
          type: 'lib',
          data: {
            root: 'lib1-root',
            targets: {
              build: {
                executor: 'nx:run-commands',
                dependsOn: [
                  {
                    dependencies: true,
                    target: 'build',
                    params: 'ignore',
                  },
                ],
              },
              test: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
        lib2: {
          name: 'lib2',
          type: 'lib',
          data: {
            root: 'lib2-root',
            targets: {
              build: {
                executor: 'nx:run-commands',
              },
              test: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
      },
      dependencies: {
        app1: [
          { source: 'app1', target: 'lib1', type: 'static' },
          { source: 'app1', target: 'lib2', type: 'static' },
        ],
        lib1: [{ source: 'lib1', target: 'lib2', type: 'static' }],
        lib2: [],
      },
    };

    const taskResult = createTaskGraph(
      projectGraph,
      {},
      ['app1'],
      ['build'],
      'development',
      {
        myFlag: 'flag value',
      }
    );

    expect(taskResult).toEqual({
      roots: ['lib2:build', 'app1:prebuild'],
      tasks: {
        'app1:build': {
          id: 'app1:build',
          target: {
            project: 'app1',
            target: 'build',
          },
          overrides: { myFlag: 'flag value' },
          projectRoot: 'app1-root',
        },
        'app1:prebuild': {
          id: 'app1:prebuild',
          target: {
            project: 'app1',
            target: 'prebuild',
          },
          overrides: { myFlag: 'flag value' },
          projectRoot: 'app1-root',
        },
        'lib1:build': {
          id: 'lib1:build',
          target: {
            project: 'lib1',
            target: 'build',
          },
          overrides: { myFlag: 'flag value' },
          projectRoot: 'lib1-root',
        },
        'lib2:build': {
          id: 'lib2:build',
          target: {
            project: 'lib2',
            target: 'build',
          },
          overrides: { __overrides_unparsed__: [] },
          projectRoot: 'lib2-root',
        },
      },
      dependencies: {
        'app1:build': ['lib1:build', 'lib2:build', 'app1:prebuild'],
        'app1:prebuild': [],
        'lib1:build': ['lib2:build'],
        'lib2:build': [],
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
      {
        __overrides_unparsed__: [],
      }
    );
    // prebuild should also be in here
    expect(taskGraph).toEqual({
      roots: ['lib1:build', 'app1:prebuild', 'app1:prebuild2'],
      tasks: {
        'app1:build': {
          id: 'app1:build',
          target: {
            project: 'app1',
            target: 'build',
          },
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
        'app1:prebuild': {
          id: 'app1:prebuild',
          target: {
            project: 'app1',
            target: 'prebuild',
          },
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
        'app1:prebuild2': {
          id: 'app1:prebuild2',
          target: {
            project: 'app1',
            target: 'prebuild2',
          },
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
        'lib1:build': {
          id: 'lib1:build',
          target: {
            project: 'lib1',
            target: 'build',
          },
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib1-root',
        },
      },
      dependencies: {
        'app1:build': ['lib1:build', 'app1:prebuild', 'app1:prebuild2'],
        'app1:prebuild': [],
        'app1:prebuild2': [],
        'lib1:build': [],
      },
    });
  });

  it('should correctly set dependencies when they are all given as inputs', () => {
    const taskGraph = createTaskGraph(
      projectGraph,
      {},
      ['app1', 'lib1'],
      ['build', 'prebuild'],
      'development',
      {
        __overrides_unparsed__: [],
      }
    );
    // prebuild should also be in here
    expect(taskGraph).toEqual({
      roots: ['app1:prebuild', 'lib1:build', 'app1:prebuild2'],
      tasks: {
        'app1:build': {
          id: 'app1:build',
          target: {
            project: 'app1',
            target: 'build',
          },
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
        'app1:prebuild': {
          id: 'app1:prebuild',
          target: {
            project: 'app1',
            target: 'prebuild',
          },
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
        'app1:prebuild2': {
          id: 'app1:prebuild2',
          target: {
            project: 'app1',
            target: 'prebuild2',
          },
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
        'lib1:build': {
          id: 'lib1:build',
          target: {
            project: 'lib1',
            target: 'build',
          },
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib1-root',
        },
      },
      dependencies: {
        'app1:build': ['lib1:build', 'app1:prebuild', 'app1:prebuild2'],
        'app1:prebuild': [],
        'app1:prebuild2': [],
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
            targets: {
              build: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
        lib1: {
          name: 'lib1',
          type: 'lib',
          data: {
            root: 'lib1-root',
            targets: {
              build: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
        lib2: {
          name: 'lib2',
          type: 'lib',
          data: {
            root: 'lib2-root',
            targets: {
              build: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
        lib3: {
          name: 'lib3',
          type: 'lib',
          data: {
            root: 'lib3-root',
            targets: {
              build: {
                executor: 'nx:run-commands',
              },
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
            dependencies: true,
            target: 'build',
          },
        ],
      },
      ['app1'],
      ['build'],
      'development',
      {
        __overrides_unparsed__: [],
      }
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
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
        'lib1:build': {
          id: 'lib1:build',
          target: {
            project: 'lib1',
            target: 'build',
          },
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib1-root',
        },
        'lib2:build': {
          id: 'lib2:build',
          target: {
            project: 'lib2',
            target: 'build',
          },
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib2-root',
        },
        'lib3:build': {
          id: 'lib3:build',
          target: {
            project: 'lib3',
            target: 'build',
          },
          overrides: {
            __overrides_unparsed__: [],
          },
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

  it('should handle-mix of targets', () => {
    projectGraph = {
      nodes: {
        app1: {
          name: 'app1',
          type: 'app',
          data: {
            root: 'app1-root',
            targets: {
              build: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
        app2: {
          name: 'app2',
          type: 'app',
          data: {
            root: 'app2-root',
            targets: {
              build: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
        infra1: {
          name: 'infra1',
          type: 'app',
          data: {
            root: 'infra1-root',
            targets: {
              apply: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
        infra2: {
          name: 'infra2',
          type: 'app',
          data: {
            root: 'infra2-root',
            targets: {
              apply: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
        coreInfra: {
          name: 'coreInfra',
          type: 'app',
          data: {
            root: 'infra3-root',
            targets: {
              apply: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
      },
      dependencies: {
        app1: [],
        app2: [],
        // Scenario is app 1 depends on app 2, so this extends to the infrastructure projects
        infra1: [
          { source: 'infra1', target: 'coreInfra', type: 'implicit' },
          { source: 'infra1', target: 'infra2', type: 'implicit' },
          { source: 'infra1', target: 'app1', type: 'implicit' },
        ],
        infra2: [
          { source: 'infra2', target: 'coreInfra', type: 'implicit' },
          { source: 'infra1', target: 'app2', type: 'implicit' },
        ],
        coreInfra: [],
      },
    };

    const taskGraph = createTaskGraph(
      projectGraph,
      {
        build: ['^build'],
        apply: [
          { dependencies: true, target: 'build' },
          {
            dependencies: true,
            target: 'apply',
            params: 'forward',
          },
        ],
      },
      ['infra1'],
      ['apply'],
      'development',
      {
        myFlag: 'flag value',
      }
    );

    // prebuild should also be in here
    expect(taskGraph).toEqual({
      roots: ['app2:build', 'coreInfra:apply', 'app1:build'],
      tasks: {
        'infra1:apply': {
          id: 'infra1:apply',
          target: { project: 'infra1', target: 'apply' },
          projectRoot: 'infra1-root',
          overrides: { myFlag: 'flag value' },
        },
        'app2:build': {
          id: 'app2:build',
          target: { project: 'app2', target: 'build' },
          projectRoot: 'app2-root',
          overrides: { __overrides_unparsed__: [] },
        },
        'coreInfra:apply': {
          id: 'coreInfra:apply',
          target: { project: 'coreInfra', target: 'apply' },
          projectRoot: 'infra3-root',
          overrides: { myFlag: 'flag value' },
        },
        'app1:build': {
          id: 'app1:build',
          target: { project: 'app1', target: 'build' },
          projectRoot: 'app1-root',
          overrides: { __overrides_unparsed__: [] },
        },
        'infra2:apply': {
          id: 'infra2:apply',
          target: { project: 'infra2', target: 'apply' },
          projectRoot: 'infra2-root',
          overrides: { myFlag: 'flag value' },
        },
      },
      dependencies: {
        'infra1:apply': [
          'app2:build',
          'coreInfra:apply',
          'app1:build',
          'infra2:apply',
        ],
        'app2:build': [],
        'coreInfra:apply': [],
        'app1:build': [],
        'infra2:apply': ['app2:build', 'coreInfra:apply'],
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
            targets: {
              build: {
                executor: 'nx:run-commands',
                dependsOn: [{ target: 'test' }],
              },
              test: {
                executor: 'nx:run-commands',
                dependsOn: [{ target: 'build' }],
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
      {
        __overrides_unparsed__: [],
      }
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
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
        'app1:test': {
          id: 'app1:test',
          target: {
            project: 'app1',
            target: 'test',
          },
          overrides: {
            __overrides_unparsed__: [],
          },
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
            targets: {
              build: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
        app2: {
          name: 'app2',
          type: 'app',
          data: {
            root: 'app2-root',
            targets: {},
          },
        },
        app3: {
          name: 'app3',
          type: 'app',
          data: {
            root: 'app3-root',
            targets: {
              build: {
                executor: 'nx:run-commands',
              },
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
        build: [{ target: 'build', dependencies: true }],
      },
      ['app1'],
      ['build'],
      'development',
      {
        __overrides_unparsed__: [],
      }
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
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
        'app3:build': {
          id: 'app3:build',
          target: {
            project: 'app3',
            target: 'build',
          },
          overrides: {
            __overrides_unparsed__: [],
          },
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
            targets: {
              build: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
        app2: {
          name: 'app2',
          type: 'app',
          data: {
            root: 'app2-root',
            targets: {},
          },
        },
        app3: {
          name: 'app3',
          type: 'app',
          data: {
            root: 'app3-root',
            targets: {
              build: {
                executor: 'nx:run-commands',
              },
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
        build: [{ target: 'build', dependencies: true }],
      },
      ['app1'],
      ['build'],
      'development',
      {
        __overrides_unparsed__: [],
      }
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
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
        'app3:build': {
          id: 'app3:build',
          target: {
            project: 'app3',
            target: 'build',
          },
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app3-root',
        },
      },
      dependencies: {
        'app1:build': ['app3:build'],
        'app3:build': [],
      },
    });
  });

  it('should exclude task dependencies', () => {
    projectGraph = {
      nodes: {
        app1: {
          name: 'app1',
          type: 'app',
          data: {
            root: 'app1-root',
            targets: {
              build: {
                executor: 'nx:run-commands',
                dependsOn: [
                  { target: 'prebuild' },
                  { target: 'build', dependencies: true },
                ],
              },
              prebuild: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
        app2: {
          name: 'app2',
          type: 'app',
          data: {
            root: 'app2-root',
            targets: {
              build: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
      },
      dependencies: {
        app1: [{ source: 'app1', target: 'app2', type: DependencyType.static }],
        app2: [],
      },
    };

    const taskGraph = createTaskGraph(
      projectGraph,
      {},
      ['app1'],
      ['build'],
      'development',
      {
        __overrides_unparsed__: [],
      },
      true
    );
    // prebuild should also be in here
    expect(taskGraph).toEqual({
      roots: ['app1:build'],
      tasks: {
        'app1:build': {
          id: 'app1:build',
          target: {
            project: 'app1',
            target: 'build',
          },
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
      },
      dependencies: {
        'app1:build': [],
      },
    });

    const taskGraph2 = createTaskGraph(
      projectGraph,
      {},
      ['app1', 'app2'],
      ['build'],
      'development',
      {
        __overrides_unparsed__: [],
      },
      true
    );
    // prebuild should also be in here
    expect(taskGraph2).toEqual({
      roots: ['app2:build'],
      tasks: {
        'app1:build': {
          id: 'app1:build',
          target: {
            project: 'app1',
            target: 'build',
          },
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
        'app2:build': {
          id: 'app2:build',
          target: {
            project: 'app2',
            target: 'build',
          },
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app2-root',
        },
      },
      dependencies: {
        'app1:build': ['app2:build'],
        'app2:build': [],
      },
    });
  });

  it('should handle glob patterns in dependsOn', () => {
    const graph: ProjectGraph = {
      nodes: {
        app1: {
          name: 'app1',
          type: 'app',
          data: {
            root: 'app1-root',
            targets: {
              build: {
                executor: 'nx:run-commands',
                dependsOn: [{ target: 'build', projects: 'lib*' }],
              },
            },
          },
        },
        lib1: {
          name: 'lib1',
          type: 'lib',
          data: {
            root: 'lib1-root',
            targets: {
              build: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
        lib2: {
          name: 'lib2',
          type: 'lib',
          data: {
            root: 'lib2-root',
            targets: {
              build: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
      },
      dependencies: {
        app1: [],
      },
    };
    const taskGraph = createTaskGraph(graph, {}, ['app1'], ['build'], null, {});
    expect(taskGraph.tasks).toHaveProperty('app1:build');
    expect(taskGraph.tasks).toHaveProperty('lib1:build');
    expect(taskGraph.tasks).toHaveProperty('lib2:build');
    expect(taskGraph.dependencies['app1:build']).toEqual([
      'lib1:build',
      'lib2:build',
    ]);
  });
});
