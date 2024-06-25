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
              precompile: {
                executor: 'nx:run-commands',
              },
              precompile2: {
                executor: 'nx:run-commands',
              },
              compile: {
                executor: 'nx:run-commands',
                dependsOn: [
                  {
                    dependencies: true,
                    target: 'compile',
                  },
                  {
                    target: 'precompile',
                  },
                  {
                    projects: 'app1',
                    target: 'precompile2',
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
              compile: {
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
          outputs: [],
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
          outputs: [],
          overrides: { a: 123 },
          projectRoot: 'app1-root',
        },
        'lib1:test': {
          id: 'lib1:test',
          target: {
            project: 'lib1',
            target: 'test',
          },
          outputs: [],
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

  it('should return tasks with outputs', () => {
    projectGraph.nodes.app1.data.targets.test.outputs = [
      '{workspaceRoot}/dist/app1',
    ];
    const taskGraph = createTaskGraph(
      projectGraph,
      {},
      ['app1'],
      ['test'],
      'development',
      {
        a: 123,
      }
    );

    expect(taskGraph.tasks['app1:test'].outputs).toEqual(['dist/app1']);
  });

  it('should return tasks with interpolated outputs', () => {
    projectGraph.nodes.app1.data.targets.test.outputs = [
      '{workspaceRoot}/dist/{projectRoot}',
    ];
    const taskGraph = createTaskGraph(
      projectGraph,
      {},
      ['app1'],
      ['test'],
      'development',
      {
        a: 123,
      }
    );

    expect(taskGraph.tasks['app1:test'].outputs).toEqual(['dist/app1-root']);
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
              compile: {
                executor: 'my-executor',
                configurations: {
                  ci: {},
                },
                dependsOn: [
                  {
                    dependencies: true,
                    target: 'compile',
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
              compile: {
                executor: 'my-executor',
                configurations: {
                  libDefault: {},
                },
                defaultConfiguration: 'libDefault',
                dependsOn: [
                  {
                    dependencies: true,
                    target: 'compile',
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
              compile: {
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

    const compileLib = createTaskGraph(
      projectGraph,
      {},
      ['lib1'],
      ['compile'],
      null,
      {}
    );

    expect(compileLib).toEqual({
      roots: ['lib2:compile'],
      tasks: {
        'lib1:compile:libDefault': {
          id: 'lib1:compile:libDefault',
          target: {
            project: 'lib1',
            target: 'compile',
            configuration: 'libDefault',
          },
          outputs: [],
          overrides: {},
          projectRoot: 'lib1-root',
        },
        'lib2:compile': {
          id: 'lib2:compile',
          target: {
            project: 'lib2',
            target: 'compile',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib2-root',
        },
      },
      dependencies: {
        'lib1:compile:libDefault': ['lib2:compile'],
        'lib2:compile': [],
      },
    });

    const compileApp = createTaskGraph(
      projectGraph,
      {},
      ['app1'],
      ['compile'],
      'ci',
      {}
    );

    expect(compileApp).toEqual({
      roots: ['lib2:compile:ci'],
      tasks: {
        'app1:compile:ci': {
          id: 'app1:compile:ci',
          target: {
            project: 'app1',
            target: 'compile',
            configuration: 'ci',
          },
          outputs: [],
          overrides: {},
          projectRoot: 'app1-root',
        },
        'lib1:compile:libDefault': {
          id: 'lib1:compile:libDefault',
          target: {
            project: 'lib1',
            target: 'compile',
            configuration: 'libDefault',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib1-root',
        },
        'lib2:compile:ci': {
          id: 'lib2:compile:ci',
          target: {
            project: 'lib2',
            target: 'compile',
            configuration: 'ci',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib2-root',
        },
      },
      dependencies: {
        'app1:compile:ci': ['lib1:compile:libDefault'],
        'lib1:compile:libDefault': ['lib2:compile:ci'],
        'lib2:compile:ci': [],
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
              compile: {
                executor: 'my-executor',
                dependsOn: [
                  {
                    dependencies: true,
                    target: 'compile',
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
              compile: {
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

    const compileApp = createTaskGraph(
      projectGraph,
      {},
      ['app1'],
      ['compile'],
      null,
      {}
    );

    expect(compileApp).toEqual({
      dependencies: {
        'app1:compile': ['lib3:compile'],
        'lib3:compile': [],
      },
      roots: ['lib3:compile'],
      tasks: {
        'app1:compile': {
          id: 'app1:compile',
          outputs: [],
          overrides: {},
          projectRoot: 'app1-root',
          target: {
            project: 'app1',
            target: 'compile',
          },
        },
        'lib3:compile': {
          id: 'lib3:compile',
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib3-root',
          target: {
            project: 'lib3',
            target: 'compile',
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
          outputs: [],
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
          outputs: [],
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
              'precompile-base': {
                executor: 'nx:run-commands',
              },
              precompile: {
                executor: 'nx:run-commands',
              },
              compile: {
                executor: 'nx:run-commands',
                dependsOn: [
                  {
                    dependencies: true,
                    target: 'compile',
                    params: 'forward',
                  },
                  { target: 'precompile', params: 'forward' },
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
              compile: {
                executor: 'nx:run-commands',
                dependsOn: [
                  {
                    dependencies: true,
                    target: 'compile',
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
              compile: {
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
      ['compile'],
      'development',
      {
        myFlag: 'flag value',
      }
    );

    expect(taskResult).toEqual({
      roots: ['lib2:compile', 'app1:precompile'],
      tasks: {
        'app1:compile': {
          id: 'app1:compile',
          target: {
            project: 'app1',
            target: 'compile',
          },
          outputs: [],
          overrides: { myFlag: 'flag value' },
          projectRoot: 'app1-root',
        },
        'app1:precompile': {
          id: 'app1:precompile',
          target: {
            project: 'app1',
            target: 'precompile',
          },
          outputs: [],
          overrides: { myFlag: 'flag value' },
          projectRoot: 'app1-root',
        },
        'lib1:compile': {
          id: 'lib1:compile',
          target: {
            project: 'lib1',
            target: 'compile',
          },
          outputs: [],
          overrides: { myFlag: 'flag value' },
          projectRoot: 'lib1-root',
        },
        'lib2:compile': {
          id: 'lib2:compile',
          target: {
            project: 'lib2',
            target: 'compile',
          },
          outputs: [],
          overrides: { __overrides_unparsed__: [] },
          projectRoot: 'lib2-root',
        },
      },
      dependencies: {
        'app1:compile': ['lib1:compile', 'lib2:compile', 'app1:precompile'],
        'app1:precompile': [],
        'lib1:compile': ['lib2:compile'],
        'lib2:compile': [],
      },
    });
  });

  it('should create graphs with dependencies', () => {
    const taskGraph = createTaskGraph(
      projectGraph,
      {},
      ['app1'],
      ['compile'],
      'development',
      {
        __overrides_unparsed__: [],
      }
    );
    // precompile should also be in here
    expect(taskGraph).toEqual({
      roots: ['lib1:compile', 'app1:precompile', 'app1:precompile2'],
      tasks: {
        'app1:compile': {
          id: 'app1:compile',
          target: {
            project: 'app1',
            target: 'compile',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
        'app1:precompile': {
          id: 'app1:precompile',
          target: {
            project: 'app1',
            target: 'precompile',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
        'app1:precompile2': {
          id: 'app1:precompile2',
          target: {
            project: 'app1',
            target: 'precompile2',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
        'lib1:compile': {
          id: 'lib1:compile',
          target: {
            project: 'lib1',
            target: 'compile',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib1-root',
        },
      },
      dependencies: {
        'app1:compile': ['lib1:compile', 'app1:precompile', 'app1:precompile2'],
        'app1:precompile': [],
        'app1:precompile2': [],
        'lib1:compile': [],
      },
    });
  });

  it('should correctly set dependencies when they are all given as inputs', () => {
    const taskGraph = createTaskGraph(
      projectGraph,
      {},
      ['app1', 'lib1'],
      ['compile', 'precompile'],
      'development',
      {
        __overrides_unparsed__: [],
      }
    );
    // precompile should also be in here
    expect(taskGraph).toEqual({
      roots: ['app1:precompile', 'lib1:compile', 'app1:precompile2'],
      tasks: {
        'app1:compile': {
          id: 'app1:compile',
          target: {
            project: 'app1',
            target: 'compile',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
        'app1:precompile': {
          id: 'app1:precompile',
          target: {
            project: 'app1',
            target: 'precompile',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
        'app1:precompile2': {
          id: 'app1:precompile2',
          target: {
            project: 'app1',
            target: 'precompile2',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
        'lib1:compile': {
          id: 'lib1:compile',
          target: {
            project: 'lib1',
            target: 'compile',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib1-root',
        },
      },
      dependencies: {
        'app1:compile': ['lib1:compile', 'app1:precompile', 'app1:precompile2'],
        'app1:precompile': [],
        'app1:precompile2': [],
        'lib1:compile': [],
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
              compile: {
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
              compile: {
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
              compile: {
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
              compile: {
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
        compile: [
          {
            dependencies: true,
            target: 'compile',
          },
        ],
      },
      ['app1'],
      ['compile'],
      'development',
      {
        __overrides_unparsed__: [],
      }
    );
    // precompile should also be in here
    expect(taskGraph).toEqual({
      roots: ['lib3:compile'],
      tasks: {
        'app1:compile': {
          id: 'app1:compile',
          target: {
            project: 'app1',
            target: 'compile',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
        'lib1:compile': {
          id: 'lib1:compile',
          target: {
            project: 'lib1',
            target: 'compile',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib1-root',
        },
        'lib2:compile': {
          id: 'lib2:compile',
          target: {
            project: 'lib2',
            target: 'compile',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib2-root',
        },
        'lib3:compile': {
          id: 'lib3:compile',
          target: {
            project: 'lib3',
            target: 'compile',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib3-root',
        },
      },
      dependencies: {
        'app1:compile': ['lib1:compile', 'lib2:compile'],
        'lib1:compile': ['lib3:compile'],
        'lib2:compile': ['lib3:compile'],
        'lib3:compile': [],
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
              compile: {
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
              compile: {
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
        compile: ['^compile'],
        apply: [
          { dependencies: true, target: 'compile' },
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

    // precompile should also be in here
    expect(taskGraph).toEqual({
      roots: ['app2:compile', 'coreInfra:apply', 'app1:compile'],
      tasks: {
        'infra1:apply': {
          id: 'infra1:apply',
          target: { project: 'infra1', target: 'apply' },
          projectRoot: 'infra1-root',
          outputs: [],
          overrides: { myFlag: 'flag value' },
        },
        'app2:compile': {
          id: 'app2:compile',
          target: { project: 'app2', target: 'compile' },
          projectRoot: 'app2-root',
          outputs: [],
          overrides: { __overrides_unparsed__: [] },
        },
        'coreInfra:apply': {
          id: 'coreInfra:apply',
          target: { project: 'coreInfra', target: 'apply' },
          projectRoot: 'infra3-root',
          outputs: [],
          overrides: { myFlag: 'flag value' },
        },
        'app1:compile': {
          id: 'app1:compile',
          target: { project: 'app1', target: 'compile' },
          projectRoot: 'app1-root',
          outputs: [],
          overrides: { __overrides_unparsed__: [] },
        },
        'infra2:apply': {
          id: 'infra2:apply',
          target: { project: 'infra2', target: 'apply' },
          projectRoot: 'infra2-root',
          outputs: [],
          overrides: { myFlag: 'flag value' },
        },
      },
      dependencies: {
        'infra1:apply': [
          'app2:compile',
          'coreInfra:apply',
          'app1:compile',
          'infra2:apply',
        ],
        'app2:compile': [],
        'coreInfra:apply': [],
        'app1:compile': [],
        'infra2:apply': ['app2:compile', 'coreInfra:apply'],
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
              compile: {
                executor: 'nx:run-commands',
                dependsOn: [{ target: 'test' }],
              },
              test: {
                executor: 'nx:run-commands',
                dependsOn: [{ target: 'compile' }],
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
      ['compile'],
      'development',
      {
        __overrides_unparsed__: [],
      }
    );
    // precompile should also be in here
    expect(taskGraph).toEqual({
      roots: [],
      tasks: {
        'app1:compile': {
          id: 'app1:compile',
          target: {
            project: 'app1',
            target: 'compile',
          },
          outputs: [],
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
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
      },
      dependencies: {
        'app1:compile': ['app1:test'],
        'app1:test': ['app1:compile'],
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
              compile: {
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
              compile: {
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
        compile: [{ target: 'compile', dependencies: true }],
      },
      ['app1'],
      ['compile'],
      'development',
      {
        __overrides_unparsed__: [],
      }
    );
    expect(taskGraph).toEqual({
      roots: [],
      tasks: {
        'app1:compile': {
          id: 'app1:compile',
          target: {
            project: 'app1',
            target: 'compile',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
        'app3:compile': {
          id: 'app3:compile',
          target: {
            project: 'app3',
            target: 'compile',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app3-root',
        },
      },
      dependencies: {
        'app1:compile': ['app3:compile'],
        'app3:compile': ['app1:compile'],
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
              compile: {
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
              compile: {
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
        compile: [{ target: 'compile', dependencies: true }],
      },
      ['app1'],
      ['compile'],
      'development',
      {
        __overrides_unparsed__: [],
      }
    );
    expect(taskGraph).toEqual({
      roots: ['app3:compile'],
      tasks: {
        'app1:compile': {
          id: 'app1:compile',
          target: {
            project: 'app1',
            target: 'compile',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
        'app3:compile': {
          id: 'app3:compile',
          target: {
            project: 'app3',
            target: 'compile',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app3-root',
        },
      },
      dependencies: {
        'app1:compile': ['app3:compile'],
        'app3:compile': [],
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
              compile: {
                executor: 'nx:run-commands',
                dependsOn: [
                  { target: 'precompile' },
                  { target: 'compile', dependencies: true },
                ],
              },
              precompile: {
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
              compile: {
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
      ['compile'],
      'development',
      {
        __overrides_unparsed__: [],
      },
      true
    );
    // precompile should also be in here
    expect(taskGraph).toEqual({
      roots: ['app1:compile'],
      tasks: {
        'app1:compile': {
          id: 'app1:compile',
          target: {
            project: 'app1',
            target: 'compile',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
      },
      dependencies: {
        'app1:compile': [],
      },
    });

    const taskGraph2 = createTaskGraph(
      projectGraph,
      {},
      ['app1', 'app2'],
      ['compile'],
      'development',
      {
        __overrides_unparsed__: [],
      },
      true
    );
    // precompile should also be in here
    expect(taskGraph2).toEqual({
      roots: ['app2:compile'],
      tasks: {
        'app1:compile': {
          id: 'app1:compile',
          target: {
            project: 'app1',
            target: 'compile',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
        },
        'app2:compile': {
          id: 'app2:compile',
          target: {
            project: 'app2',
            target: 'compile',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app2-root',
        },
      },
      dependencies: {
        'app1:compile': ['app2:compile'],
        'app2:compile': [],
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

  it('should handle negative patterns in dependsOn', () => {
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
                dependsOn: [{ target: 'build', projects: '!lib1' }],
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
              foo: {
                executor: 'nx:noop',
                dependsOn: [
                  {
                    target: 'build',
                    projects: ['lib*', '!lib1'],
                  },
                ],
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
        app1: [],
      },
    };
    const taskGraph = createTaskGraph(graph, {}, ['app1'], ['build'], null, {});
    expect(taskGraph.tasks).toHaveProperty('app1:build');
    expect(taskGraph.tasks).not.toHaveProperty('lib1:build');
    expect(taskGraph.tasks).toHaveProperty('lib2:build');
    expect(taskGraph.dependencies['app1:build']).toEqual([
      'lib2:build',
      'lib3:build',
    ]);
    const taskGraph2 = createTaskGraph(graph, {}, ['lib2'], ['foo'], null, {});
    expect(taskGraph2.tasks).toHaveProperty('lib2:foo');
    expect(taskGraph2.dependencies['lib2:foo']).toEqual([
      'lib2:build',
      'lib3:build',
    ]);
  });
});
