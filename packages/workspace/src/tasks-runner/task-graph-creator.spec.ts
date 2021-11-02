import { createTasksForProjectToRun } from './run-command';
import { DependencyType, ProjectGraph } from '@nrwl/devkit';
import { TaskGraphCreator } from './task-graph-creator';

describe('TaskGraphCreator', () => {
  it('should return empty for an empty array', () => {
    const empty = new TaskGraphCreator(
      {
        nodes: {},
        dependencies: {},
      },
      {}
    ).createTaskGraph([]);
    expect(empty).toEqual({
      roots: [],
      tasks: {},
      dependencies: {},
    });
  });

  it('should order tasks based on project dependencies', () => {
    const taskGraph = new TaskGraphCreator(
      {
        nodes: {
          child1: { type: 'lib' },
          child2: { type: 'lib' },
          parent: { type: 'lib' },
          grandparent: { type: 'lib' },
        } as any,
        dependencies: {
          child1: [],
          child2: [],
          parent: [
            {
              source: 'parent',
              target: 'child1',
              type: DependencyType.static,
            },
            {
              source: 'parent',
              target: 'child2',
              type: DependencyType.static,
            },
          ],
          grandparent: [
            {
              source: 'grandparent',
              target: 'parent',
              type: DependencyType.static,
            },
          ],
        },
      },
      {
        build: [
          {
            target: 'build',
            projects: 'dependencies',
          },
        ],
      }
    ).createTaskGraph([
      {
        id: 'parent:build',
        target: { project: 'parent', target: 'build' },
      },
      {
        id: 'child1:build',
        target: { project: 'child1', target: 'build' },
      },
      {
        id: 'child2:build',
        target: { project: 'child2', target: 'build' },
      },
      {
        id: 'grandparent:build',
        target: { project: 'grandparent', target: 'build' },
      },
    ] as any);

    expect(taskGraph.roots).toEqual(['child1:build', 'child2:build']);

    expect(Object.keys(taskGraph.tasks)).toEqual([
      'parent:build',
      'child1:build',
      'child2:build',
      'grandparent:build',
    ]);

    expect(taskGraph.dependencies).toEqual({
      'child1:build': [],
      'child2:build': [],
      'grandparent:build': ['parent:build'],
      'parent:build': ['child1:build', 'child2:build'],
    });
  });

  it('should support custom targets that require strict ordering', () => {
    const taskGraph = new TaskGraphCreator(
      {
        nodes: {
          child1: { type: 'lib', data: { targets: { custom: {} } } },
          parent: { type: 'lib', data: { targets: { custom: {} } } },
        } as any,
        dependencies: {
          child1: [],
          parent: [
            {
              source: 'parent',
              target: 'child1',
              type: DependencyType.static,
            },
          ],
        },
      },
      {
        custom: [
          {
            target: 'custom',
            projects: 'dependencies',
          },
        ],
      }
    ).createTaskGraph([
      {
        id: 'parent:custom',
        target: { project: 'parent', target: 'custom' },
      },
      {
        id: 'child1:custom',
        target: { project: 'child1', target: 'custom' },
      },
    ] as any);

    expect(taskGraph.roots).toEqual(['child1:custom']);

    expect(Object.keys(taskGraph.tasks)).toEqual([
      'parent:custom',
      'child1:custom',
    ]);

    expect(taskGraph.dependencies).toEqual({
      'child1:custom': [],
      'parent:custom': ['child1:custom'],
    });

    const noDeps = new TaskGraphCreator(
      {
        nodes: {
          child1: { type: 'lib', data: { targets: { custom: {} } } },
          parent: { type: 'lib', data: { targets: { custom: {} } } },
        } as any,
        dependencies: {
          child1: [],
          parent: [
            {
              source: 'parent',
              target: 'child1',
              type: DependencyType.static,
            },
          ],
        },
      },
      {}
    ).createTaskGraph([
      {
        id: 'parent:custom',
        target: { project: 'parent', target: 'custom' },
      },
      {
        id: 'child1:custom',
        target: { project: 'child1', target: 'custom' },
      },
    ] as any);

    expect(noDeps.roots).toEqual(['parent:custom', 'child1:custom']);
  });

  describe('(tasks with dependency configurations)', () => {
    let projectGraph: ProjectGraph;
    beforeEach(() => {
      projectGraph = {
        nodes: {
          app1: {
            type: 'app',
            name: 'app1',
            data: {
              targets: {
                build: {
                  dependsOn: [
                    {
                      target: 'build',
                      projects: 'dependencies',
                    },
                  ],
                },
              },
              root: 'app1-root',
              files: [],
            },
          },
          app2: {
            type: 'app',
            name: 'app2',
            data: {
              targets: {
                build: {
                  dependsOn: [
                    {
                      target: 'build',
                      projects: 'dependencies',
                    },
                  ],
                },
              },
              root: 'app2-root',
              files: [],
            },
          },
          common1: {
            type: 'lib',
            name: 'common1',
            data: {
              targets: {
                build: {
                  dependsOn: [
                    {
                      target: 'build',
                      projects: 'dependencies',
                    },
                  ],
                },
              },
              root: 'common1-root',
              files: [],
            },
          },
          common2: {
            type: 'lib',
            name: 'common2',
            data: {
              targets: {
                build: {
                  dependsOn: [
                    {
                      target: 'build',
                      projects: 'dependencies',
                    },
                  ],
                },
              },
              root: 'common2-root',
              files: [],
            },
          },
        },
        dependencies: {
          app1: [
            {
              source: 'app1',
              target: 'common1',
              type: DependencyType.static,
            },
          ],
          app2: [
            {
              source: 'app2',
              target: 'common2',
              type: DependencyType.static,
            },
          ],
          common1: [],
          common2: [],
        },
      };
    });

    it('should create task graph (builds depend on build of dependencies)', () => {
      const tasks = createTasksForProjectToRun(
        [projectGraph.nodes.app1, projectGraph.nodes.app2],
        {
          target: 'build',
          configuration: undefined,
          overrides: {},
        },
        projectGraph,
        null
      );

      const taskGraph = new TaskGraphCreator(projectGraph, {}).createTaskGraph(
        tasks
      );

      expect(taskGraph).toMatchSnapshot();
    });

    it('should create a task graph (builds depend on builds of dependencies even with intermediate projects)', () => {
      delete projectGraph.nodes.common1.data.targets.build;
      projectGraph.dependencies.common1.push({
        type: DependencyType.static,
        source: 'common1',
        target: 'common2',
      });

      const tasks = createTasksForProjectToRun(
        [projectGraph.nodes.app1],
        {
          target: 'build',
          configuration: undefined,
          overrides: {},
        },
        projectGraph,
        null
      );

      const taskGraph = new TaskGraphCreator(projectGraph, {}).createTaskGraph(
        tasks
      );

      expect(taskGraph).toMatchSnapshot();
    });

    it('should create a task graph (builds depend on builds of dependencies with intermediate projects and circular dependencies between projects)', () => {
      delete projectGraph.nodes.common1.data.targets.build;
      projectGraph.dependencies.common1.push({
        type: DependencyType.static,
        source: 'common1',
        target: 'common2',
      });

      projectGraph.dependencies.common2.push({
        type: DependencyType.static,
        source: 'common2',
        target: 'common1',
      });

      const tasks = createTasksForProjectToRun(
        [projectGraph.nodes.app1],
        {
          target: 'build',
          configuration: undefined,
          overrides: {},
        },
        projectGraph,
        null
      );

      const taskGraph = new TaskGraphCreator(projectGraph, {}).createTaskGraph(
        tasks
      );

      expect(taskGraph).toMatchSnapshot();
    });

    it('should create a task graph (builds depend on builds of dependencies with intermediate projects and circular dependencies between projects) 2', () => {
      delete projectGraph.nodes.common1.data.targets.build;
      projectGraph.dependencies.common1.push({
        type: DependencyType.static,
        source: 'common1',
        target: 'common2',
      });

      delete projectGraph.nodes.common2.data.targets.build;
      projectGraph.dependencies.common2.push({
        type: DependencyType.static,
        source: 'common2',
        target: 'common3',
      });

      projectGraph.nodes.common3 = {
        name: 'common3',
        type: 'lib',
        data: {
          root: 'common3',
          targets: {
            build: {},
          },
        },
      };
      projectGraph.dependencies.common3 = [];

      const tasks = createTasksForProjectToRun(
        [projectGraph.nodes.app1],
        {
          target: 'build',
          configuration: undefined,
          overrides: {},
        },
        projectGraph,
        null
      );

      const taskGraph = new TaskGraphCreator(projectGraph, {}).createTaskGraph(
        tasks
      );

      expect(taskGraph).toMatchSnapshot();
    });

    it('should create task graph (builds depend on build of dependencies and prebuild of self)', () => {
      projectGraph.nodes.app1.data.targets.prebuild = {};
      projectGraph.nodes.app2.data.targets.prebuild = {};
      projectGraph.nodes.app1.data.targets.build.dependsOn.push({
        projects: 'self',
        target: 'prebuild',
      });
      projectGraph.nodes.app2.data.targets.build.dependsOn.push({
        projects: 'self',
        target: 'prebuild',
      });
      const tasks = createTasksForProjectToRun(
        [projectGraph.nodes.app1, projectGraph.nodes.app2],
        {
          target: 'build',
          configuration: undefined,
          overrides: {},
        },
        projectGraph,
        null
      );
      const taskGraph = new TaskGraphCreator(projectGraph, {}).createTaskGraph(
        tasks
      );

      expect(taskGraph).toMatchSnapshot();
    });

    it('should create task graph (builds depend on build of dependencies, builds depend on prebuilds)', () => {
      projectGraph.nodes.app1.data.targets.prebuild = {
        dependsOn: [
          {
            target: 'build',
            projects: 'dependencies',
          },
        ],
      };
      projectGraph.nodes.app2.data.targets.prebuild = {
        dependsOn: [
          {
            target: 'build',
            projects: 'dependencies',
          },
        ],
      };
      projectGraph.nodes.app1.data.targets.build.dependsOn.push({
        projects: 'self',
        target: 'prebuild',
      });
      projectGraph.nodes.app2.data.targets.build.dependsOn.push({
        projects: 'self',
        target: 'prebuild',
      });
      const tasks = createTasksForProjectToRun(
        [projectGraph.nodes.app1, projectGraph.nodes.app2],
        {
          target: 'build',
          configuration: undefined,
          overrides: {},
        },
        projectGraph,
        null
      );
      const taskGraph = new TaskGraphCreator(projectGraph, {}).createTaskGraph(
        tasks
      );

      expect(taskGraph).toMatchSnapshot();
    });

    it('should create task graph (builds depend on build of dependencies, builds depend on prebuilds)', () => {
      projectGraph.nodes.common1.data.targets =
        projectGraph.nodes.common2.data.targets = {
          prebuild: {},
          build: {
            dependsOn: [
              {
                target: 'build',
                projects: 'dependencies',
              },
              {
                target: 'prebuild',
                projects: 'self',
              },
            ],
          },
        };
      projectGraph.nodes.app1.data.targets =
        projectGraph.nodes.app2.data.targets = {
          build: {
            dependsOn: [
              {
                target: 'build',
                projects: 'dependencies',
              },
            ],
          },
        };
      const tasks = createTasksForProjectToRun(
        [projectGraph.nodes.app1, projectGraph.nodes.app2],
        {
          target: 'build',
          configuration: undefined,
          overrides: {},
        },
        projectGraph,
        null
      );

      const taskGraph = new TaskGraphCreator(projectGraph, {}).createTaskGraph(
        tasks
      );

      expect(taskGraph).toMatchSnapshot();
    });
  });
});
