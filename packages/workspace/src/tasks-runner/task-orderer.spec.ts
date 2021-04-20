import { TaskOrderer } from './task-orderer';
import { DependencyType } from '../core/project-graph';
import { createTasksForProjectToRun } from './run-command';
import { ProjectGraph } from '@nrwl/devkit';

describe('TaskStages', () => {
  it('should return empty for an empty array', () => {
    const stages = new TaskOrderer({} as any, 'build', {
      nodes: {},
      dependencies: {},
    }).splitTasksIntoStages([]);
    expect(stages).toEqual([]);
  });

  it('should split tasks into stages based on their dependencies', () => {
    const stages = new TaskOrderer({} as any, 'build', {
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
    }).splitTasksIntoStages([
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

    expect(stages).toEqual([
      [
        {
          id: 'child1:build',
          target: { project: 'child1', target: 'build' },
        },
        {
          id: 'child2:build',
          target: { project: 'child2', target: 'build' },
        },
      ],
      [
        {
          id: 'parent:build',
          target: { project: 'parent', target: 'build' },
        },
      ],
      [
        {
          id: 'grandparent:build',
          target: { project: 'grandparent', target: 'build' },
        },
      ],
    ]);
  });

  it('should support custom targets that require strict ordering', () => {
    const stages = new TaskOrderer(
      { strictlyOrderedTargets: ['custom'] } as any,
      'custom',
      {
        nodes: { child1: { type: 'lib' }, parent: { type: 'lib' } } as any,
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
      }
    ).splitTasksIntoStages([
      {
        id: 'parent:custom',
        target: { project: 'parent', target: 'custom' },
      },
      {
        id: 'child1:custom',
        target: { project: 'child1', target: 'custom' },
      },
    ] as any);

    expect(stages).toEqual([
      [
        {
          id: 'child1:custom',
          target: { project: 'child1', target: 'custom' },
        },
      ],
      [
        {
          id: 'parent:custom',
          target: { project: 'parent', target: 'custom' },
        },
      ],
    ]);

    const noStages = new TaskOrderer(
      { strictlyOrderedTargets: ['custom'] } as any,
      'some-other-custom',
      {
        nodes: {},
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
      }
    ).splitTasksIntoStages([
      {
        target: { project: 'parent' },
      },
      {
        target: { project: 'child1' },
      },
    ] as any);

    expect(noStages).toEqual([
      [
        {
          target: { project: 'parent' },
        },
        {
          target: { project: 'child1' },
        },
      ],
    ]);
  });

  it('should split tasks into stages based on their dependencies when there are unrelated packages', () => {
    const stages = new TaskOrderer({} as any, 'build', {
      nodes: {
        app1: { type: 'lib' },
        app2: { type: 'lib' },
        common1: { type: 'lib' },
        common2: { type: 'lib' },
      } as any,
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
    }).splitTasksIntoStages([
      {
        id: 'app1:build',
        target: { project: 'app1', target: 'build' },
      },
      {
        id: 'app2:build',
        target: { project: 'app2', target: 'build' },
      },
      {
        id: 'common1:build',
        target: { project: 'common1', target: 'build' },
      },
      {
        id: 'common2:build',
        target: { project: 'common2', target: 'build' },
      },
    ] as any);

    expect(stages).toEqual([
      [
        {
          id: 'common1:build',
          target: { project: 'common1', target: 'build' },
        },
        {
          id: 'common2:build',
          target: { project: 'common2', target: 'build' },
        },
      ],
      [
        {
          id: 'app1:build',
          target: { project: 'app1', target: 'build' },
        },
        {
          id: 'app2:build',
          target: { project: 'app2', target: 'build' },
        },
      ],
    ]);
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

    it('should split tasks into stages (builds depend on build of dependencies)', () => {
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

      const stages = new TaskOrderer(
        {} as any,
        'build',
        projectGraph
      ).splitTasksIntoStages(tasks);

      // lib builds should be in their own stage
      // app builds should be in a later stage
      expect(stages).toMatchSnapshot();
    });

    it('should split tasks into stages  (builds depend on build of dependencies and prebuild of self)', () => {
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
      const stages = new TaskOrderer(
        {} as any,
        'build',
        projectGraph
      ).splitTasksIntoStages(tasks);

      // lib builds with the prebuild tasks in a stage
      // app builds should be in a later stage
      expect(stages).toMatchSnapshot();
    });

    it('should split tasks into stages  (builds depend on build of dependencies and prebuild of self, prebuilds depends on build of dependencies)', () => {
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
      const stages = new TaskOrderer(
        {} as any,
        'build',
        projectGraph
      ).splitTasksIntoStages(tasks);

      // lib builds in the first stage
      // app prebuilds in the next stage
      // app builds in the last stage
      expect(stages).toMatchSnapshot();
    });

    it('should split tasks into stages  (builds depend on build of dependencies, builds depend on prebuilds)', () => {
      projectGraph.nodes.common1.data.targets = projectGraph.nodes.common2.data.targets = {
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
      projectGraph.nodes.app1.data.targets = projectGraph.nodes.app2.data.targets = {
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

      const stages = new TaskOrderer(
        {} as any,
        'build',
        projectGraph
      ).splitTasksIntoStages(tasks);

      // lib prebuilds in the first stage
      // lib builds in the next stage
      // app builds in the last stage
      expect(stages).toMatchSnapshot();
    });
  });
});
