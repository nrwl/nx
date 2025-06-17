import {
  DependencyType,
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../config/project-graph';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
import {
  createTaskGraph,
  filterDummyTasks,
  getNonDummyDeps,
} from './create-task-graph';

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
                continuous: true,
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
      continuousDependencies: {},
      continueOnFailureDependencies: {},
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
          parallelism: true,
          continuous: false,
        },
      },
      dependencies: {
        'app1:test': [],
      },
      continuousDependencies: {
        'app1:test': [],
      },
      continueOnFailureDependencies: {
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
        },
      },
      dependencies: {
        'app1:test': [],
        'lib1:test': [],
      },
      continuousDependencies: {
        'app1:test': [],
        'lib1:test': [],
      },
      continueOnFailureDependencies: {
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
        },
      },
      dependencies: {
        'lib1:compile:libDefault': ['lib2:compile'],
        'lib2:compile': [],
      },
      continuousDependencies: {
        'lib1:compile:libDefault': [],
        'lib2:compile': [],
      },
      continueOnFailureDependencies: {
        'lib1:compile:libDefault': [],
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
        },
      },
      dependencies: {
        'app1:compile:ci': ['lib1:compile:libDefault'],
        'lib1:compile:libDefault': ['lib2:compile:ci'],
        'lib2:compile:ci': [],
      },
      continuousDependencies: {
        'app1:compile:ci': [],
        'lib1:compile:libDefault': [],
        'lib2:compile:ci': [],
      },
      continueOnFailureDependencies: {
        'app1:compile:ci': [],
        'lib1:compile:libDefault': [],
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
      continuousDependencies: {
        'app1:compile': [],
        'lib3:compile': [],
      },
      continueOnFailureDependencies: {
        'app1:compile': [],
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
        },
      },
      dependencies: {
        'app1:test': [],
      },
      continuousDependencies: {
        'app1:test': [],
      },
      continueOnFailureDependencies: {
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
          parallelism: true,
          continuous: false,
        },
      },
      dependencies: {
        'app1:test': [],
      },
      continuousDependencies: {
        'app1:test': [],
      },
      continueOnFailureDependencies: {
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
        },
      },
      dependencies: {
        'app1:compile': ['lib1:compile', 'lib2:compile', 'app1:precompile'],
        'app1:precompile': [],
        'lib1:compile': ['lib2:compile'],
        'lib2:compile': [],
      },
      continuousDependencies: {
        'app1:compile': [],
        'app1:precompile': [],
        'lib1:compile': [],
        'lib2:compile': [],
      },
      continueOnFailureDependencies: {
        'app1:compile': [],
        'app1:precompile': [],
        'lib1:compile': [],
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
        },
      },
      dependencies: {
        'app1:compile': ['lib1:compile', 'app1:precompile', 'app1:precompile2'],
        'app1:precompile': [],
        'app1:precompile2': [],
        'lib1:compile': [],
      },
      continuousDependencies: {
        'app1:compile': [],
        'app1:precompile': [],
        'app1:precompile2': [],
        'lib1:compile': [],
      },
      continueOnFailureDependencies: {
        'app1:compile': [],
        'app1:precompile': [],
        'app1:precompile2': [],
        'lib1:compile': [],
      },
    });
  });

  it('should create graphs with continuous dependencies', () => {
    projectGraph.nodes['app1'].data.targets['serve'].dependsOn = [
      {
        dependencies: true,
        target: 'serve',
      },
      {
        target: 'compile',
      },
    ];
    projectGraph.nodes['app1'].data.targets['compile'].dependsOn = [
      {
        dependencies: true,
        target: 'compile',
      },
    ];
    projectGraph.nodes['lib1'].data.targets['serve'] = {
      executor: 'nx:run-command',
      continuous: true,
      dependsOn: [
        {
          dependencies: true,
          target: 'serve',
        },
        {
          target: 'compile',
        },
      ],
    };
    const taskGraph = createTaskGraph(
      projectGraph,
      {},
      ['app1'],
      ['serve'],
      undefined,
      {
        __overrides_unparsed__: [],
      }
    );
    // precompile should also be in here
    expect(taskGraph).toEqual({
      roots: ['lib1:compile'],
      tasks: {
        'app1:serve': {
          id: 'app1:serve',
          target: {
            project: 'app1',
            target: 'serve',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
          parallelism: true,
          continuous: true,
        },
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
          parallelism: true,
          continuous: false,
        },
        'lib1:serve': {
          id: 'lib1:serve',
          target: {
            project: 'lib1',
            target: 'serve',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib1-root',
          parallelism: true,
          continuous: true,
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
          parallelism: true,
          continuous: false,
        },
      },
      dependencies: {
        'app1:serve': ['app1:compile'],
        'app1:compile': ['lib1:compile'],
        'lib1:serve': ['lib1:compile'],
        'lib1:compile': [],
      },
      continuousDependencies: {
        'app1:serve': ['lib1:serve'],
        'app1:compile': [],
        'lib1:serve': [],
        'lib1:compile': [],
      },
      continueOnFailureDependencies: {
        'app1:serve': [],
        'app1:compile': [],
        'lib1:serve': [],
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
        },
      },
      dependencies: {
        'app1:compile': ['lib1:compile', 'app1:precompile', 'app1:precompile2'],
        'app1:precompile': [],
        'app1:precompile2': [],
        'lib1:compile': [],
      },
      continuousDependencies: {
        'app1:compile': [],
        'app1:precompile': [],
        'app1:precompile2': [],
        'lib1:compile': [],
      },
      continueOnFailureDependencies: {
        'app1:compile': [],
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
        },
      },
      dependencies: {
        'app1:compile': ['lib1:compile', 'lib2:compile'],
        'lib1:compile': ['lib3:compile'],
        'lib2:compile': ['lib3:compile'],
        'lib3:compile': [],
      },
      continuousDependencies: {
        'app1:compile': [],
        'lib1:compile': [],
        'lib2:compile': [],
        'lib3:compile': [],
      },
      continueOnFailureDependencies: {
        'app1:compile': [],
        'lib1:compile': [],
        'lib2:compile': [],
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
          parallelism: true,
          continuous: false,
        },
        'app2:compile': {
          id: 'app2:compile',
          target: { project: 'app2', target: 'compile' },
          projectRoot: 'app2-root',
          outputs: [],
          overrides: { __overrides_unparsed__: [] },
          parallelism: true,
          continuous: false,
        },
        'coreInfra:apply': {
          id: 'coreInfra:apply',
          target: { project: 'coreInfra', target: 'apply' },
          projectRoot: 'infra3-root',
          outputs: [],
          overrides: { myFlag: 'flag value' },
          parallelism: true,
          continuous: false,
        },
        'app1:compile': {
          id: 'app1:compile',
          target: { project: 'app1', target: 'compile' },
          projectRoot: 'app1-root',
          outputs: [],
          overrides: { __overrides_unparsed__: [] },
          parallelism: true,
          continuous: false,
        },
        'infra2:apply': {
          id: 'infra2:apply',
          target: { project: 'infra2', target: 'apply' },
          projectRoot: 'infra2-root',
          outputs: [],
          overrides: { myFlag: 'flag value' },
          parallelism: true,
          continuous: false,
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
      continuousDependencies: {
        'infra1:apply': [],
        'app2:compile': [],
        'coreInfra:apply': [],
        'app1:compile': [],
        'infra2:apply': [],
      },
      continueOnFailureDependencies: {
        'infra1:apply': [],
        'app2:compile': [],
        'coreInfra:apply': [],
        'app1:compile': [],
        'infra2:apply': [],
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
        },
      },
      dependencies: {
        'app1:compile': ['app1:test'],
        'app1:test': ['app1:compile'],
      },
      continuousDependencies: {
        'app1:compile': [],
        'app1:test': [],
      },
      continueOnFailureDependencies: {
        'app1:compile': [],
        'app1:test': [],
      },
    });
  });

  it('should handle cycles between projects where all projects contain the same task target (lib1:build -> lib2:build -> lib3:build -> lib4:build -> lib1:build)', () => {
    projectGraph = {
      nodes: {
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
        lib4: {
          name: 'lib4',
          type: 'lib',
          data: {
            root: 'lib4-root',
            targets: {
              build: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
      },
      dependencies: {
        lib1: [{ source: 'lib1', target: 'lib2', type: 'static' }],
        lib2: [{ source: 'lib2', target: 'lib3', type: 'static' }],
        lib3: [{ source: 'lib3', target: 'lib4', type: 'static' }],
        lib4: [{ source: 'lib4', target: 'lib1', type: 'static' }],
      },
    };

    const taskGraph = createTaskGraph(
      projectGraph,
      {
        build: [{ target: 'build', dependencies: true }],
      },
      ['lib1'],
      ['build'],
      'development',
      {
        __overrides_unparsed__: [],
      }
    );
    expect(taskGraph).toEqual({
      roots: [],
      tasks: {
        'lib1:build': expect.objectContaining({
          id: 'lib1:build',
          target: {
            project: 'lib1',
            target: 'build',
          },
          outputs: expect.arrayContaining([expect.any(String)]),
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib1-root',
          parallelism: true,
          continuous: false,
        }),
        'lib2:build': expect.objectContaining({
          id: 'lib2:build',
          target: {
            project: 'lib2',
            target: 'build',
          },
          outputs: expect.arrayContaining([expect.any(String)]),
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib2-root',
          parallelism: true,
          continuous: false,
        }),
        'lib3:build': expect.objectContaining({
          id: 'lib3:build',
          target: {
            project: 'lib3',
            target: 'build',
          },
          outputs: expect.arrayContaining([expect.any(String)]),
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib3-root',
          parallelism: true,
          continuous: false,
        }),
        'lib4:build': expect.objectContaining({
          id: 'lib4:build',
          target: {
            project: 'lib4',
            target: 'build',
          },
          outputs: expect.arrayContaining([expect.any(String)]),
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib4-root',
          parallelism: true,
          continuous: false,
        }),
      },
      dependencies: {
        'lib1:build': ['lib2:build'],
        'lib2:build': ['lib3:build'],
        'lib3:build': ['lib4:build'],
        'lib4:build': ['lib1:build'],
      },
      continuousDependencies: {
        'lib1:build': [],
        'lib2:build': [],
        'lib3:build': [],
        'lib4:build': [],
      },
      continueOnFailureDependencies: {
        'lib1:build': [],
        'lib2:build': [],
        'lib3:build': [],
        'lib4:build': [],
      },
    });
  });

  it('should handle cycles between projects where all projects do not contain the same task target (lib1:build -> lib2:build -> lib3 -> lib4:build)', () => {
    projectGraph = {
      nodes: {
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
            targets: {},
          },
        },
        lib4: {
          name: 'lib4',
          type: 'lib',
          data: {
            root: 'lib4-root',
            targets: {
              build: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
      },
      dependencies: {
        lib1: [{ source: 'lib1', target: 'lib2', type: 'static' }],
        lib2: [{ source: 'lib2', target: 'lib3', type: 'static' }],
        lib3: [{ source: 'lib3', target: 'lib4', type: 'static' }],
      },
    };

    const taskGraph = createTaskGraph(
      projectGraph,
      {
        build: [{ target: 'build', dependencies: true }],
      },
      ['lib1'],
      ['build'],
      'development',
      {
        __overrides_unparsed__: [],
      }
    );
    expect(taskGraph).toEqual({
      roots: ['lib4:build'],
      tasks: {
        'lib1:build': expect.objectContaining({
          id: 'lib1:build',
          target: {
            project: 'lib1',
            target: 'build',
          },
          outputs: expect.arrayContaining([expect.any(String)]),
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib1-root',
          parallelism: true,
          continuous: false,
        }),
        'lib2:build': expect.objectContaining({
          id: 'lib2:build',
          target: {
            project: 'lib2',
            target: 'build',
          },
          outputs: expect.arrayContaining([expect.any(String)]),
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib2-root',
          parallelism: true,
          continuous: false,
        }),
        'lib4:build': expect.objectContaining({
          id: 'lib4:build',
          target: {
            project: 'lib4',
            target: 'build',
          },
          outputs: expect.arrayContaining([expect.any(String)]),
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib4-root',
          parallelism: true,
          continuous: false,
        }),
      },
      dependencies: {
        'lib1:build': ['lib2:build'],
        'lib2:build': ['lib4:build'],
        'lib4:build': [],
      },
      continuousDependencies: {
        'lib1:build': [],
        'lib2:build': [],
        'lib4:build': [],
      },
      continueOnFailureDependencies: {
        'lib1:build': [],
        'lib2:build': [],
        'lib4:build': [],
      },
    });
  });

  it('should handle cycles where tasks seem to depend on themselves (lib1:build -> lib2 -> lib1:build)', () => {
    projectGraph = {
      nodes: {
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
            targets: {},
          },
        },
      },
      dependencies: {
        lib1: [{ source: 'lib1', target: 'lib2', type: 'static' }],
        lib2: [{ source: 'lib2', target: 'lib1', type: 'static' }],
      },
    };

    const taskGraph = createTaskGraph(
      projectGraph,
      {
        build: [{ target: 'build', dependencies: true }],
      },
      ['lib1'],
      ['build'],
      'development',
      {
        __overrides_unparsed__: [],
      }
    );
    expect(taskGraph).toEqual({
      roots: ['lib1:build'],
      tasks: {
        'lib1:build': expect.objectContaining({
          id: 'lib1:build',
          target: {
            project: 'lib1',
            target: 'build',
          },
          outputs: expect.arrayContaining([expect.any(String)]),
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib1-root',
          parallelism: true,
          continuous: false,
        }),
      },
      dependencies: {
        'lib1:build': [],
      },
      continuousDependencies: {
        'lib1:build': [],
      },
      continueOnFailureDependencies: {
        'lib1:build': [],
      },
    });
  });

  it('should handle cycles between projects where all projects do not contain the same task target (lib1:build -> lib2:build -> lib3 -> lib4:build -> lib1:build)', () => {
    projectGraph = {
      nodes: {
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
            targets: {},
          },
        },
        lib4: {
          name: 'lib4',
          type: 'lib',
          data: {
            root: 'lib4-root',
            targets: {
              build: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
      },
      dependencies: {
        lib1: [{ source: 'lib1', target: 'lib2', type: 'static' }],
        lib2: [{ source: 'lib2', target: 'lib3', type: 'static' }],
        lib3: [{ source: 'lib3', target: 'lib4', type: 'static' }],
        lib4: [{ source: 'lib4', target: 'lib1', type: 'static' }],
      },
    };

    const taskGraph = createTaskGraph(
      projectGraph,
      {
        build: [{ target: 'build', dependencies: true }],
      },
      ['lib1'],
      ['build'],
      'development',
      {
        __overrides_unparsed__: [],
      }
    );
    expect(taskGraph).toEqual({
      roots: ['lib2:build'],
      tasks: {
        'lib1:build': expect.objectContaining({
          id: 'lib1:build',
          target: {
            project: 'lib1',
            target: 'build',
          },
          outputs: expect.arrayContaining([expect.any(String)]),
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib1-root',
          parallelism: true,
          continuous: false,
        }),
        'lib2:build': expect.objectContaining({
          id: 'lib2:build',
          target: {
            project: 'lib2',
            target: 'build',
          },
          outputs: expect.arrayContaining([expect.any(String)]),
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib2-root',
          parallelism: true,
          continuous: false,
        }),
        'lib4:build': expect.objectContaining({
          id: 'lib4:build',
          target: {
            project: 'lib4',
            target: 'build',
          },
          outputs: expect.arrayContaining([expect.any(String)]),
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib4-root',
          parallelism: true,
          continuous: false,
        }),
      },
      dependencies: {
        'lib1:build': ['lib2:build'],
        'lib2:build': [],
        'lib4:build': ['lib1:build'],
      },
      continuousDependencies: {
        'lib1:build': [],
        'lib2:build': [],
        'lib4:build': [],
      },
      continueOnFailureDependencies: {
        'lib1:build': [],
        'lib2:build': [],
        'lib4:build': [],
      },
    });
  });

  it('should handle cycles between projects where all projects do not contain the same task target (lib1:build -> lib2:build -> lib3 -> lib4 -> lib1:build)', () => {
    projectGraph = {
      nodes: {
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
            targets: {},
          },
        },
        lib4: {
          name: 'lib4',
          type: 'lib',
          data: {
            root: 'lib4-root',
            targets: {},
          },
        },
      },
      dependencies: {
        lib1: [{ source: 'lib1', target: 'lib2', type: 'static' }],
        lib2: [{ source: 'lib2', target: 'lib3', type: 'static' }],
        lib3: [{ source: 'lib3', target: 'lib4', type: 'static' }],
        lib4: [{ source: 'lib4', target: 'lib1', type: 'static' }],
      },
    };

    const taskGraph = createTaskGraph(
      projectGraph,
      {
        build: [{ target: 'build', dependencies: true }],
      },
      ['lib1'],
      ['build'],
      'development',
      {
        __overrides_unparsed__: [],
      }
    );
    expect(taskGraph).toEqual({
      roots: ['lib2:build'],
      tasks: {
        'lib1:build': expect.objectContaining({
          id: 'lib1:build',
          target: {
            project: 'lib1',
            target: 'build',
          },
          outputs: expect.arrayContaining([expect.any(String)]),
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib1-root',
          parallelism: true,
          continuous: false,
        }),
        'lib2:build': expect.objectContaining({
          id: 'lib2:build',
          target: {
            project: 'lib2',
            target: 'build',
          },
          outputs: expect.arrayContaining([expect.any(String)]),
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib2-root',
          parallelism: true,
          continuous: false,
        }),
      },
      dependencies: {
        'lib1:build': ['lib2:build'],
        'lib2:build': [],
      },
      continuousDependencies: {
        'lib1:build': [],
        'lib2:build': [],
      },
      continueOnFailureDependencies: {
        'lib1:build': [],
        'lib2:build': [],
      },
    });
  });

  it('should handle cycles between projects where all projects do not contain the same task target (app1:build <-> app2 <-> app3:build)', () => {
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
      roots: ['app1:compile', 'app3:compile'],
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
        },
      },
      dependencies: {
        'app1:compile': [],
        'app3:compile': [],
      },
      continuousDependencies: {
        'app1:compile': [],
        'app3:compile': [],
      },
      continueOnFailureDependencies: {
        'app1:compile': [],
        'app3:compile': [],
      },
    });
  });

  it('should handle cycles between projects that do not create cycles between tasks and not contain the same task target (app1:build -> app2 <-> app3:build)', () => {
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
      roots: ['app1:compile', 'app3:compile'],
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
        },
      },
      dependencies: {
        'app1:compile': [],
        'app3:compile': [],
      },
      continuousDependencies: {
        'app1:compile': [],
        'app3:compile': [],
      },
      continueOnFailureDependencies: {
        'app1:compile': [],
        'app3:compile': [],
      },
    });
  });

  it('should not conflate dependencies of dummy tasks', () => {
    projectGraph = {
      nodes: {
        app1: {
          name: 'app1',
          type: 'app',
          data: {
            root: 'app1-root',
            targets: {
              test: {
                executor: 'nx:run-commands',
                dependsOn: ['^dep2'],
              },
              lint: {
                executor: 'nx:run-commands',
                dependsOn: ['^dep'],
              },
            },
          },
        },
        lib1: {
          name: 'lib1',
          type: 'app',
          data: {
            root: 'lib1-root',
            targets: {},
          },
        },
        lib2: {
          name: 'lib2',
          type: 'app',
          data: {
            root: 'lib2-root',
            targets: {
              dep: {
                executor: 'nx:run-commands',
              },
              dep2: {
                executor: 'nx:run-commands',
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
    };

    const taskGraph = createTaskGraph(
      projectGraph,
      {},
      ['app1'],
      ['lint', 'test'],
      undefined,
      {
        __overrides_unparsed__: [],
      }
    );
    expect(taskGraph).toEqual({
      roots: ['lib2:dep', 'lib2:dep2'],
      tasks: {
        'app1:lint': {
          id: 'app1:lint',
          target: {
            project: 'app1',
            target: 'lint',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app1-root',
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
        },
        'lib2:dep': {
          id: 'lib2:dep',
          target: {
            project: 'lib2',
            target: 'dep',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib2-root',
          parallelism: true,
          continuous: false,
        },
        'lib2:dep2': {
          id: 'lib2:dep2',
          target: {
            project: 'lib2',
            target: 'dep2',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'lib2-root',
          parallelism: true,
          continuous: false,
        },
      },
      dependencies: {
        'app1:lint': ['lib2:dep'],
        'app1:test': ['lib2:dep2'],
        'lib2:dep': [],
        'lib2:dep2': [],
      },
      continuousDependencies: {
        'app1:lint': [],
        'app1:test': [],
        'lib2:dep': [],
        'lib2:dep2': [],
      },
      continueOnFailureDependencies: {
        'app1:lint': [],
        'app1:test': [],
        'lib2:dep': [],
        'lib2:dep2': [],
      },
    });
  });

  it('should create deterministic task graphs regardless of target order', () => {
    // This test addresses an issue where dummy tasks (created when a dependency project
    // doesn't have the required target) would have different dependency structures
    // depending on the order targets were processed. Previously, these dummy tasks would
    // improperly inherit different configurations based on which source task (test vs lint)
    // created them first, leading to non-deterministic task graphs.
    projectGraph = {
      nodes: {
        app1: {
          name: 'app1',
          type: 'app',
          data: {
            root: 'app1-root',
            targets: {
              test: {
                executor: 'nx:run-commands',
                dependsOn: ['^test', '^lint'],
              },
              lint: {
                executor: 'nx:run-commands',
                dependsOn: ['^lint'],
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
              // No targets - will create dummy tasks
            },
          },
        },
        lib2: {
          name: 'lib2',
          type: 'lib',
          data: {
            root: 'lib2-root',
            targets: {
              test: {
                executor: 'nx:run-commands',
                dependsOn: ['^test', '^lint'],
              },
              lint: {
                executor: 'nx:run-commands',
                dependsOn: ['^lint'],
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
    };

    // Create task graphs with different target orders
    const taskGraph1 = createTaskGraph(
      projectGraph,
      {},
      ['app1'],
      ['test', 'lint'], // test first
      undefined,
      { __overrides_unparsed__: [] }
    );

    const taskGraph2 = createTaskGraph(
      projectGraph,
      {},
      ['app1'],
      ['lint', 'test'], // lint first
      undefined,
      { __overrides_unparsed__: [] }
    );

    taskGraph1.roots.sort();
    taskGraph2.roots.sort();

    // Both task graphs should be identical
    expect(taskGraph1).toEqual(taskGraph2);
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
          parallelism: true,
          continuous: false,
        },
      },
      dependencies: {
        'app1:compile': [],
      },
      continuousDependencies: {
        'app1:compile': [],
      },
      continueOnFailureDependencies: {
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
        },
      },
      dependencies: {
        'app1:compile': ['app2:compile'],
        'app2:compile': [],
      },
      continuousDependencies: {
        'app1:compile': [],
        'app2:compile': [],
      },
      continueOnFailureDependencies: {
        'app1:compile': [],
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

  it('should handle multiple dependsOn task groups', () => {
    const taskGraph = createTaskGraph(
      {
        nodes: {
          a: {
            name: 'a',
            type: 'app',
            data: {
              root: 'a-root',
              targets: {
                deploy: {
                  executor: 'nx:run-commands',
                  dependsOn: [{ target: 'build' }],
                },
                build: {
                  executor: 'nx:run-commands',
                  dependsOn: [{ target: 'compile' }],
                },
                compile: {
                  executor: 'nx:run-commands',
                  dependsOn: ['^compile'],
                },
              },
            },
          },
          b: {
            name: 'b',
            type: 'lib',
            data: {
              root: 'b-root',
              targets: {
                deploy: {
                  executor: 'nx:run-commands',
                  dependsOn: [{ target: 'build' }],
                },
                build: {
                  executor: 'nx:run-commands',
                  dependsOn: [{ target: 'compile' }],
                },
                compile: {
                  executor: 'nx:run-commands',
                  dependsOn: ['^compile'],
                },
              },
            },
          },
          c: {
            name: 'c',
            type: 'lib',
            data: {
              root: 'c-root',
              targets: {
                deploy: {
                  executor: 'nx:run-commands',
                  dependsOn: [{ target: 'build' }],
                },
                build: {
                  executor: 'nx:run-commands',
                  dependsOn: [{ target: 'compile' }],
                },
                compile: {
                  executor: 'nx:run-commands',
                  dependsOn: ['^compile'],
                },
              },
            },
          },
          d: {
            name: 'd',
            type: 'lib',
            data: {
              root: 'd-root',
              targets: {
                deploy: {
                  executor: 'nx:run-commands',
                  dependsOn: [{ target: 'build' }],
                },
                build: {
                  executor: 'nx:run-commands',
                  dependsOn: [{ target: 'compile' }],
                },
                compile: {
                  executor: 'nx:run-commands',
                  dependsOn: ['^compile'],
                },
              },
            },
          },
        },
        dependencies: {
          a: [],
          b: [
            {
              source: 'b',
              target: 'd',
              type: 'static',
            },
          ],
          c: [
            {
              source: 'c',
              target: 'd',
              type: 'static',
            },
          ],
          d: [],
        },
      },
      {},
      ['a', 'b'],
      ['deploy'],
      null,
      {}
    );

    expect(taskGraph.dependencies['a:deploy']).toEqual(['a:build']);
    expect(taskGraph.dependencies['a:build']).toEqual(['a:compile']);
    expect(taskGraph.dependencies['a:compile']).toEqual([]);
    expect(taskGraph.dependencies['b:deploy']).toEqual(['b:build']);
    expect(taskGraph.dependencies['b:build']).toEqual(['b:compile']);
    expect(taskGraph.dependencies['b:compile']).toEqual(['d:compile']);
    expect(taskGraph.dependencies['d:compile']).toEqual([]);
  });

  it('should handle deep dependsOn groups', () => {
    const taskGraph = createTaskGraph(
      new GraphBuilder()
        .addProjectConfiguration({
          name: 'app-1',
          targets: {
            deploy: {
              executor: 'foo',
              dependsOn: ['build'],
            },
            build: {
              executor: 'foo',
              dependsOn: ['^build', 'codegen'],
            },
            codegen: {
              executor: 'foo',
            },
          },
        })
        .addProjectConfiguration({
          name: 'app-2',
          targets: {
            deploy: {
              executor: 'foo',
              dependsOn: ['build'],
            },
            build: {
              executor: 'foo',
              dependsOn: [
                '^build',
                {
                  target: 'codegen',
                  params: 'forward',
                },
              ],
            },
            codegen: {
              executor: 'foo',
            },
          },
        })
        .addProjectConfiguration({
          name: 'app-3',
          targets: {
            deploy: {
              executor: 'foo',
              dependsOn: ['build'],
            },
            build: {
              executor: 'foo',
              dependsOn: [
                '^build',
                {
                  target: 'codegen',
                  params: 'forward',
                },
              ],
            },
            codegen: {
              executor: 'foo',
            },
          },
        })
        .addProjectConfiguration({
          name: 'lib-1',
          targets: {
            build: {
              executor: 'foo',
              dependsOn: ['^build', 'codegen'],
            },
            codegen: {
              executor: 'foo',
            },
          },
        })
        .addProjectConfiguration({
          name: 'lib-2',
          targets: {
            build: {
              executor: 'foo',
              dependsOn: ['^build', 'codegen'],
            },
            codegen: {
              executor: 'foo',
            },
          },
        })
        .addDependencies({
          'app-1': ['lib-1'],
          'app-2': ['lib-2'],
          'app-3': ['lib-2'],
          'lib-1': ['lib-2'],
          'lib-2': [],
        })
        .build(),
      {},
      ['app-1', 'app-2', 'app-3'],
      ['deploy', 'test'],
      null,
      {},
      false
    );

    expect(taskGraph.dependencies).toMatchInlineSnapshot(`
      {
        "app-1:build": [
          "lib-1:build",
          "app-1:codegen",
        ],
        "app-1:codegen": [],
        "app-1:deploy": [
          "app-1:build",
        ],
        "app-2:build": [
          "lib-2:build",
          "app-2:codegen",
        ],
        "app-2:codegen": [],
        "app-2:deploy": [
          "app-2:build",
        ],
        "app-3:build": [
          "lib-2:build",
          "app-3:codegen",
        ],
        "app-3:codegen": [],
        "app-3:deploy": [
          "app-3:build",
        ],
        "lib-1:build": [
          "lib-2:build",
          "lib-1:codegen",
        ],
        "lib-1:codegen": [],
        "lib-2:build": [
          "lib-2:codegen",
        ],
        "lib-2:codegen": [],
      }
    `);
  });

  it('should handle mulitple projects that are dependent on each other (app1->app2->app3->app4)', () => {
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
                dependsOn: ['precompiple', '^precompile'],
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
                dependsOn: ['precompiple', '^precompile'],
              },
            },
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
                dependsOn: ['precompiple', '^precompile'],
              },
            },
          },
        },
        app4: {
          name: 'app4',
          type: 'app',
          data: {
            root: 'app4-root',
            targets: {
              precompile: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
      },
      dependencies: {
        app1: [{ source: 'app1', target: 'app2', type: 'implicit' }],
        app2: [{ source: 'app2', target: 'app3', type: 'implicit' }],
        app3: [{ source: 'app3', target: 'app4', type: 'implicit' }],
      },
    };

    let taskGraph = createTaskGraph(
      projectGraph,
      {},
      ['app1'],
      ['compile'],
      'development',
      {
        __overrides_unparsed__: [],
      }
    );
    expect(taskGraph).toEqual({
      roots: ['app4:precompile'],
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
          parallelism: true,
          continuous: false,
        },
        'app4:precompile': {
          id: 'app4:precompile',
          target: {
            project: 'app4',
            target: 'precompile',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app4-root',
          parallelism: true,
          continuous: false,
        },
      },
      dependencies: {
        'app1:compile': ['app4:precompile'],
        'app4:precompile': [],
      },
      continuousDependencies: {
        'app1:compile': [],
        'app4:precompile': [],
      },
      continueOnFailureDependencies: {
        'app1:compile': [],
        'app4:precompile': [],
      },
    });

    taskGraph = createTaskGraph(
      projectGraph,
      {},
      ['app2', 'app3'],
      ['compile'],
      'development',
      {
        __overrides_unparsed__: [],
      }
    );
    expect(taskGraph).toEqual({
      roots: ['app4:precompile'],
      tasks: {
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
          parallelism: true,
          continuous: false,
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
          parallelism: true,
          continuous: false,
        },
        'app4:precompile': {
          id: 'app4:precompile',
          target: {
            project: 'app4',
            target: 'precompile',
          },
          outputs: [],
          overrides: {
            __overrides_unparsed__: [],
          },
          projectRoot: 'app4-root',
          parallelism: true,
          continuous: false,
        },
      },
      dependencies: {
        'app2:compile': ['app4:precompile'],
        'app3:compile': ['app4:precompile'],
        'app4:precompile': [],
      },
      continuousDependencies: {
        'app2:compile': [],
        'app3:compile': [],
        'app4:precompile': [],
      },
      continueOnFailureDependencies: {
        'app2:compile': [],
        'app3:compile': [],
        'app4:precompile': [],
      },
    });
  });

  it('should handle dependencies with 2 cycles (app1->app2<->app3->app4, app5->app6<->app7->app8)', () => {
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
                dependsOn: ['precompiple', '^precompile'],
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
                dependsOn: ['precompiple', '^precompile'],
              },
            },
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
                dependsOn: ['precompiple', '^precompile'],
              },
            },
          },
        },
        app4: {
          name: 'app4',
          type: 'app',
          data: {
            root: 'app4-root',
            targets: {
              precompile: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
        app5: {
          name: 'app5',
          type: 'app',
          data: {
            root: 'app5-root',
            targets: {
              compile: {
                executor: 'nx:run-commands',
                dependsOn: ['precompiple', '^precompile'],
              },
            },
          },
        },
        app6: {
          name: 'app6',
          type: 'app',
          data: {
            root: 'app6-root',
            targets: {
              compile: {
                executor: 'nx:run-commands',
                dependsOn: ['precompiple', '^precompile'],
              },
            },
          },
        },
        app7: {
          name: 'app7',
          type: 'app',
          data: {
            root: 'app7-root',
            targets: {
              compile: {
                executor: 'nx:run-commands',
                dependsOn: ['precompiple', '^precompile'],
              },
            },
          },
        },
        app8: {
          name: 'app8',
          type: 'app',
          data: {
            root: 'app8-root',
            targets: {
              precompile: {
                executor: 'nx:run-commands',
              },
            },
          },
        },
      },
      dependencies: {
        app1: [{ source: 'app1', target: 'app2', type: 'implicit' }],
        app2: [{ source: 'app2', target: 'app3', type: 'implicit' }],
        app3: [
          { source: 'app3', target: 'app4', type: 'implicit' },
          { source: 'app3', target: 'app2', type: 'implicit' },
        ],
        app5: [{ source: 'app5', target: 'app6', type: 'implicit' }],
        app6: [{ source: 'app6', target: 'app7', type: 'implicit' }],
        app7: [
          { source: 'app7', target: 'app8', type: 'implicit' },
          { source: 'app7', target: 'app6', type: 'implicit' },
        ],
      },
    };

    let taskGraph = createTaskGraph(
      projectGraph,
      {},
      ['app1', 'app2', 'app3', 'app5', 'app6', 'app7'],
      ['compile'],
      'development',
      {
        __overrides_unparsed__: [],
      }
    );
    expect(taskGraph.dependencies).toEqual({
      'app1:compile': [],
      'app2:compile': [],
      'app3:compile': ['app4:precompile'],
      'app4:precompile': [],
      'app5:compile': [],
      'app6:compile': [],
      'app7:compile': ['app8:precompile'],
      'app8:precompile': [],
    });
  });

  describe('skipOnFailure dependencies', () => {
    it('should maintain backwards compatibility (default skipOnFailure: true)', () => {
      const projectGraph: ProjectGraph = {
        nodes: {
          app1: {
            name: 'app1',
            type: 'app',
            data: {
              root: 'app1-root',
              targets: {
                build: {
                  executor: 'nx:run-commands',
                  dependsOn: ['test'], // default behavior - no skipOnFailure specified
                },
                test: {
                  executor: 'nx:run-commands',
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
        undefined,
        {}
      );

      expect(taskGraph.continueOnFailureDependencies).toEqual({
        'app1:build': [],
        'app1:test': [],
      });
      expect(taskGraph.dependencies).toEqual({
        'app1:build': ['app1:test'],
        'app1:test': [],
      });
    });

    it('should track continue-on-failure dependencies when skipOnFailure is false', () => {
      const projectGraph: ProjectGraph = {
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
                    {
                      target: 'test',
                      skipOnFailure: false, // continue even if test fails
                    },
                  ],
                },
                test: {
                  executor: 'nx:run-commands',
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
        undefined,
        {}
      );

      expect(taskGraph.continueOnFailureDependencies).toEqual({
        'app1:build': ['app1:test'],
        'app1:test': [],
      });
      expect(taskGraph.dependencies).toEqual({
        'app1:build': ['app1:test'],
        'app1:test': [],
      });
    });

    it('should handle mixed dependency types correctly', () => {
      const projectGraph: ProjectGraph = {
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
                    'lint', // default: skipOnFailure: true
                    {
                      target: 'test',
                      skipOnFailure: false, // continue even if test fails
                    },
                    {
                      target: 'docs-build',
                      skipOnFailure: true, // explicit skipOnFailure: true
                    },
                  ],
                },
                lint: {
                  executor: 'nx:run-commands',
                },
                test: {
                  executor: 'nx:run-commands',
                },
                'docs-build': {
                  executor: 'nx:run-commands',
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
        undefined,
        {}
      );

      expect(taskGraph.continueOnFailureDependencies).toEqual({
        'app1:build': ['app1:test'], // only test should continue on failure
        'app1:lint': [],
        'app1:test': [],
        'app1:docs-build': [],
      });
      expect(taskGraph.dependencies).toEqual({
        'app1:build': ['app1:lint', 'app1:test', 'app1:docs-build'],
        'app1:lint': [],
        'app1:test': [],
        'app1:docs-build': [],
      });
    });
  });
});

class GraphBuilder {
  nodes: Record<string, ProjectGraphProjectNode> = {};
  deps: Record<string, string[]> = {};

  addProjectConfiguration(
    project: Omit<ProjectConfiguration, 'root'>,
    type?: ProjectGraph['nodes'][string]['type']
  ) {
    const t = type ?? 'lib';
    this.nodes[project.name] = {
      name: project.name,
      type: t,
      data: { ...project, root: `${t}/${project.name}` },
    };
    return this;
  }

  addDependencies(deps: Record<string, string[]>) {
    for (const source of Object.keys(deps)) {
      if (!this.deps[source]) {
        this.deps[source] = [];
      }
      this.deps[source].push(...deps[source]);
    }
    return this;
  }

  build(): ProjectGraph {
    return {
      nodes: this.nodes,
      dependencies: Object.fromEntries(
        Object.entries(this.deps).map(([k, v]) => [
          k,
          v.map((d) => ({ source: k, target: d, type: 'static' })),
        ])
      ),
      externalNodes: {},
    };
  }
}

describe('filterDummyTasks', () => {
  it('should filter out dummy tasks', () => {
    const dependencies = {
      'app1:compile': ['app2:__nx_dummy_task__'],
      'app2:__nx_dummy_task__': ['app3:__nx_dummy_task__'],
      'app3:__nx_dummy_task__': ['app4:__nx_dummy_task__'],
      'app4:__nx_dummy_task__': ['app5:build'],
      'app5:build': [],
    };
    filterDummyTasks(dependencies);
    expect(dependencies).toEqual({
      'app1:compile': ['app5:build'],
      'app5:build': [],
    });
  });

  it('should filter out dummy tasks with 1 cycle', () => {
    const dependencies = {
      'app1:compile': ['app2:__nx_dummy_task__'],
      'app2:__nx_dummy_task__': ['app3:__nx_dummy_task__'],
      'app3:__nx_dummy_task__': [
        'app4:__nx_dummy_task__',
        'app2:__nx_dummy_task__',
      ],
      'app4:__nx_dummy_task__': ['app5:build'],
      'app5:build': [],
    };
    filterDummyTasks(dependencies);
    expect(dependencies).toEqual({
      'app1:compile': [],
      'app5:build': [],
    });
  });

  it('should filter out dummy tasks with 2 cycles', () => {
    const dependencies = {
      'app1:compile': ['app2:__nx_dummy_task__'],
      'app2:__nx_dummy_task__': ['app3:__nx_dummy_task__'],
      'app3:__nx_dummy_task__': [
        'app4:__nx_dummy_task__',
        'app2:__nx_dummy_task__',
      ],
      'app4:__nx_dummy_task__': ['app5:build'],
      'app5:build': [],
      'app5:compile': ['app6:__nx_dummy_task__'],
      'app6:__nx_dummy_task__': ['app7:__nx_dummy_task__'],
      'app7:__nx_dummy_task__': ['app8:precompile', 'app6:__nx_dummy_task__'],
      'app8:precompile': [],
    };
    filterDummyTasks(dependencies);
    expect(dependencies).toEqual({
      'app1:compile': [],
      'app5:build': [],
      'app5:compile': [],
      'app8:precompile': [],
    });
  });

  it('should filter out dummy tasks with a large list of dependencies without cycles', () => {
    const dependencies = {
      'app1:compile': ['app2:__nx_dummy_task__'],
      'app2:__nx_dummy_task__': ['app3:__nx_dummy_task__'],
      'app3:__nx_dummy_task__': ['app4:precompile'],
      'app4:precompile': ['app5:build'],
      'app5:build': ['app6:__nx_dummy_task__'],
      'app6:__nx_dummy_task__': ['app7:__nx_dummy_task__'],
      'app7:__nx_dummy_task__': ['app8:precompile'],
      'app8:precompile': ['app9:__nx_dummy_task__', 'app10:build'],
      'app9:__nx_dummy_task__': ['app10:__nx_dummy_task__'],
      'app10:__nx_dummy_task__': ['app11:__nx_dummy_task__'],
      'app10:build': ['app11:__nx_dummy_task__'],
      'app11:__nx_dummy_task__': ['app12:__nx_dummy_task__'],
      'app12:__nx_dummy_task__': ['app13:__nx_dummy_task__'],
      'app13:__nx_dummy_task__': ['app14:__nx_dummy_task__'],
      'app14:__nx_dummy_task__': ['app15:__nx_dummy_task__'],
      'app15:__nx_dummy_task__': ['app16:__nx_dummy_task__'],
      'app16:__nx_dummy_task__': ['app17:__nx_dummy_task__'],
      'app17:__nx_dummy_task__': ['app18:__nx_dummy_task__'],
      'app18:__nx_dummy_task__': ['app19:__nx_dummy_task__'],
      'app19:__nx_dummy_task__': ['app20:__nx_dummy_task__'],
      'app20:__nx_dummy_task__': ['app21:build'],
      'app21:build': [],
    };
    filterDummyTasks(dependencies);
    expect(dependencies).toEqual({
      'app1:compile': ['app4:precompile'],
      'app4:precompile': ['app5:build'],
      'app5:build': ['app8:precompile'],
      'app8:precompile': ['app21:build', 'app10:build'],
      'app10:build': ['app21:build'],
      'app21:build': [],
    });
  });
});

describe('getNonDummyDeps', () => {
  it('should return the non dummy dependencies', () => {
    const dependencies = {
      'app1:compile': ['app2:__nx_dummy_task__'],
      'app2:__nx_dummy_task__': ['app3:__nx_dummy_task__'],
      'app3:__nx_dummy_task__': ['app4:__nx_dummy_task__'],
      'app4:__nx_dummy_task__': ['app5:build'],
      'app5:build': [],
    };
    expect(
      getNonDummyDeps(
        'app2:__nx_dummy_task__',
        dependencies,
        null,
        new Set(['app1:compile'])
      )
    ).toEqual(['app5:build']);
  });

  it('should return the non dummy dependencies with a cycle even no cycle arg got passed in', () => {
    const dependencies = {
      'app1:compile': ['app2:__nx_dummy_task__'],
      'app2:__nx_dummy_task__': [
        'app3:__nx_dummy_task__',
        'app8:precompile',
        'app5:build',
      ],
      'app3:__nx_dummy_task__': ['app2:__nx_dummy_task__', 'app4:precompile'],
      'app4:precompile': ['app5:build'],
      'app5:build': ['app6:__nx_dummy_task__'],
      'app6:__nx_dummy_task__': ['app7:__nx_dummy_task__', 'app1:compile'],
      'app7:__nx_dummy_task__': ['app8:precompile'],
      'app8:precompile': [],
    };
    expect(getNonDummyDeps('app2:__nx_dummy_task__', dependencies)).toEqual([
      'app4:precompile',
      'app8:precompile',
      'app5:build',
    ]);
    expect(getNonDummyDeps('app3:__nx_dummy_task__', dependencies)).toEqual([
      'app8:precompile',
      'app5:build',
      'app4:precompile',
    ]);
    expect(getNonDummyDeps('app6:__nx_dummy_task__', dependencies)).toEqual([
      'app8:precompile',
      'app1:compile',
    ]);
  });

  it('should handle a long list of dependencies without cycle', () => {
    const dependencies = {
      'app1:compile': ['app2:__nx_dummy_task__'],
      'app2:__nx_dummy_task__': ['app3:__nx_dummy_task__'],
      'app3:__nx_dummy_task__': ['app4:precompile'],
      'app4:precompile': ['app5:build'],
      'app5:build': ['app6:__nx_dummy_task__'],
      'app6:__nx_dummy_task__': ['app7:__nx_dummy_task__'],
      'app7:__nx_dummy_task__': ['app8:precompile'],
      'app8:precompile': ['app9:__nx_dummy_task__', 'app10:build'],
      'app9:__nx_dummy_task__': ['app10:__nx_dummy_task__'],
      'app10:__nx_dummy_task__': ['app11:__nx_dummy_task__'],
      'app10:build': ['app11:__nx_dummy_task__'],
      'app11:__nx_dummy_task__': ['app12:__nx_dummy_task__'],
      'app12:__nx_dummy_task__': ['app13:__nx_dummy_task__'],
      'app13:__nx_dummy_task__': ['app14:__nx_dummy_task__'],
      'app14:__nx_dummy_task__': ['app15:__nx_dummy_task__'],
      'app15:__nx_dummy_task__': ['app16:__nx_dummy_task__'],
      'app16:__nx_dummy_task__': ['app17:__nx_dummy_task__'],
      'app17:__nx_dummy_task__': ['app18:__nx_dummy_task__'],
      'app18:__nx_dummy_task__': ['app19:__nx_dummy_task__'],
      'app19:__nx_dummy_task__': ['app20:__nx_dummy_task__'],
      'app20:__nx_dummy_task__': ['app21:build'],
      'app21:build': [],
    };
    expect(getNonDummyDeps('app2:__nx_dummy_task__', dependencies)).toEqual([
      'app4:precompile',
    ]);
    expect(getNonDummyDeps('app9:__nx_dummy_task__', dependencies)).toEqual([
      'app21:build',
    ]);
  });
});
