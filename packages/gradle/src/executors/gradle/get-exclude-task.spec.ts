import {
  getExcludeTasks,
  getExcludeTasksFromTaskGraph,
  getAllDependsOnFromTaskGraph,
} from './get-exclude-task';
import { ProjectGraphProjectNode, Target, TaskGraph } from '@nx/devkit';

function createTarget(project: string, target: string): Target {
  return { project, target };
}

describe('getExcludeTasks', () => {
  const nodes: any = {
    app1: {
      name: 'app1',
      type: 'app',
      data: {
        root: 'app1',
        targets: {
          test: {
            dependsOn: [
              { target: 'lint' },
              { target: 'build', projects: ['app2'] },
            ],
            options: { taskName: 'testApp1' },
          },
          lint: { options: { taskName: 'lintApp1' } },
        },
      },
    },
    app2: {
      name: 'app2',
      type: 'app',
      data: {
        root: 'app2',
        targets: {
          build: { dependsOn: [], options: { taskName: 'buildApp2' } },
        },
      },
    },
    app3: {
      name: 'app3',
      type: 'app',
      data: {
        root: 'app3',
        targets: {
          deploy: {
            dependsOn: [{ target: 'test', projects: ['app1'] }],
            options: { taskName: 'deployApp3' },
          },
        },
      },
    },
  };

  it('should exclude tasks that are not in runningTasks and have excludeDependsOn true', () => {
    const targets = new Set<Target>([
      createTarget('app1', 'test'),
      createTarget('app2', 'build'),
    ]);
    const runningTasks = new Set<Target>([createTarget('app1', 'test')]);
    const excludes = getExcludeTasks(targets, nodes, runningTasks);
    expect(excludes).toEqual(new Set(['lintApp1', 'buildApp2']));
  });

  it('should not exclude tasks if direct dependencies are running', () => {
    const targets = new Set<Target>([createTarget('app1', 'test')]);
    const runningTasks = new Set<Target>([
      createTarget('app1', 'test'),
      createTarget('app1', 'lint'),
      createTarget('app2', 'build'),
    ]);
    const excludes = getExcludeTasks(targets, nodes, runningTasks);
    expect(excludes).toEqual(new Set());
  });

  it('should handle targets with no dependencies', () => {
    const targets = new Set<Target>([createTarget('app2', 'build')]);
    const runningTasks = new Set<Target>([createTarget('app2', 'build')]);
    const excludes = getExcludeTasks(targets, nodes, runningTasks);
    expect(excludes).toEqual(new Set());
  });

  it('should handle missing project or target', () => {
    const targets = new Set<Target>([createTarget('nonexistent', 'test')]);
    const runningTasks = new Set<Target>();
    const excludes = getExcludeTasks(targets, nodes, runningTasks);
    expect(excludes).toEqual(new Set());
  });

  it('should handle dependencies that are also running tasks', () => {
    const targets = new Set<Target>([createTarget('app1', 'test')]);
    const runningTasks = new Set<Target>([
      createTarget('app1', 'test'),
      createTarget('app1', 'lint'),
    ]);
    const excludes = getExcludeTasks(targets, nodes, runningTasks);
    expect(excludes).toEqual(new Set(['buildApp2']));
  });

  it('should transitively exclude dependencies of dependencies', () => {
    const targets = new Set<Target>([createTarget('app3', 'deploy')]);
    const runningTasks = new Set<Target>([createTarget('app3', 'deploy')]);
    const excludes = getExcludeTasks(targets, nodes, runningTasks);
    expect(excludes).toEqual(new Set(['testApp1', 'lintApp1', 'buildApp2']));
  });

  it('should not exclude tasks that are in includeDependsOnTasks', () => {
    const targets = new Set<Target>([createTarget('app1', 'test')]);
    const runningTasks = new Set<Target>([createTarget('app1', 'test')]);
    const includeDependsOnTasks = new Set<string>(['lintApp1']);
    const excludes = getExcludeTasks(
      targets,
      nodes,
      runningTasks,
      includeDependsOnTasks
    );
    expect(excludes).toEqual(new Set(['buildApp2']));
  });

  it('should not exclude any tasks if all are in includeDependsOnTasks', () => {
    const targets = new Set<Target>([createTarget('app1', 'test')]);
    const runningTasks = new Set<Target>([createTarget('app1', 'test')]);
    const includeDependsOnTasks = new Set<string>(['lintApp1', 'buildApp2']);
    const excludes = getExcludeTasks(
      targets,
      nodes,
      runningTasks,
      includeDependsOnTasks
    );
    expect(excludes).toEqual(new Set());
  });

  it('should handle object-format dependsOn entries', () => {
    const objectNodes: any = {
      app1: {
        name: 'app1',
        type: 'app',
        data: {
          root: 'app1',
          targets: {
            build: {
              dependsOn: [
                { target: 'compileJava' },
                { target: 'build', projects: ['app2'] },
              ],
              options: { taskName: ':app1:build' },
            },
            compileJava: { options: { taskName: ':app1:compileJava' } },
          },
        },
      },
      app2: {
        name: 'app2',
        type: 'app',
        data: {
          root: 'app2',
          targets: {
            build: { dependsOn: [], options: { taskName: ':app2:build' } },
          },
        },
      },
    };
    const targets = new Set<Target>([createTarget('app1', 'build')]);
    const runningTasks = new Set<Target>([createTarget('app1', 'build')]);
    const excludes = getExcludeTasks(targets, objectNodes, runningTasks);
    expect(excludes).toEqual(new Set([':app1:compileJava', ':app2:build']));
  });

  it('should exclude transitive jar dependencies', () => {
    const gradleNodes: any = {
      api: {
        name: 'api',
        type: 'app',
        data: {
          root: 'api',
          targets: {
            test: {
              dependsOn: [{ target: 'jar', projects: ['lib1'] }],
              options: { taskName: ':api:test' },
            },
          },
        },
      },
      lib1: {
        name: 'lib1',
        type: 'lib',
        data: {
          root: 'lib1',
          targets: {
            jar: {
              dependsOn: [
                { target: 'jar', projects: ['lib2'] },
                { target: 'jar', projects: ['lib3'] },
              ],
              options: { taskName: ':lib1:jar' },
            },
          },
        },
      },
      lib2: {
        name: 'lib2',
        type: 'lib',
        data: {
          root: 'lib2',
          targets: {
            jar: {
              dependsOn: [],
              options: { taskName: ':lib2:jar' },
            },
          },
        },
      },
      lib3: {
        name: 'lib3',
        type: 'lib',
        data: {
          root: 'lib3',
          targets: {
            jar: {
              dependsOn: [{ target: 'jar', projects: ['lib2'] }],
              options: { taskName: ':lib3:jar' },
            },
          },
        },
      },
    };
    const targets = new Set<Target>([createTarget('api', 'test')]);
    const runningTasks = new Set<Target>([createTarget('api', 'test')]);
    const excludes = getExcludeTasks(targets, gradleNodes, runningTasks);
    expect(excludes).toEqual(new Set([':lib1:jar', ':lib2:jar', ':lib3:jar']));
  });

  it('should handle project and target names containing colons', () => {
    const colonNodes: any = {
      ':sub:project': {
        name: ':sub:project',
        type: 'app',
        data: {
          root: 'sub/project',
          targets: {
            'compile:java': {
              dependsOn: [
                { target: 'process:resources' },
                { target: 'compile:java', projects: [':other:lib'] },
              ],
              options: { taskName: ':sub:project:compileJava' },
            },
            'process:resources': {
              options: { taskName: ':sub:project:processResources' },
            },
          },
        },
      },
      ':other:lib': {
        name: ':other:lib',
        type: 'lib',
        data: {
          root: 'other/lib',
          targets: {
            'compile:java': {
              dependsOn: [],
              options: { taskName: ':other:lib:compileJava' },
            },
          },
        },
      },
    };
    const targets = new Set<Target>([
      createTarget(':sub:project', 'compile:java'),
    ]);
    const runningTasks = new Set<Target>([
      createTarget(':sub:project', 'compile:java'),
    ]);
    const excludes = getExcludeTasks(targets, colonNodes, runningTasks);
    expect(excludes).toEqual(
      new Set([':sub:project:processResources', ':other:lib:compileJava'])
    );
  });
});

function makeTaskGraph(
  tasks: Record<string, Target>,
  dependencies: Record<string, string[]> = {}
): TaskGraph {
  return {
    roots: Object.keys(tasks),
    tasks: Object.fromEntries(
      Object.entries(tasks).map(([id, target]) => [
        id,
        {
          id,
          target,
          outputs: [],
          overrides: {},
          projectRoot: target.project,
          parallelism: false,
        },
      ])
    ),
    dependencies,
    continuousDependencies: {},
  };
}

function makeNodesWithTaskNames(
  tasksByProject: Record<string, Record<string, string>>
): Record<string, ProjectGraphProjectNode> {
  const nodes: Record<string, ProjectGraphProjectNode> = {};
  for (const [project, targets] of Object.entries(tasksByProject)) {
    nodes[project] = {
      name: project,
      type: 'lib',
      data: {
        root: project,
        targets: Object.fromEntries(
          Object.entries(targets).map(([target, taskName]) => [
            target,
            { options: { taskName } },
          ])
        ),
      },
    };
  }
  return nodes;
}

describe('getExcludeTasksFromTaskGraph', () => {
  const nodes = makeNodesWithTaskNames({
    app1: { test: ':app1:test', lint: ':app1:lint' },
    app2: { build: ':app2:build' },
    lib1: { jar: ':lib1:jar' },
    lib2: { jar: ':lib2:jar' },
  });

  it('excludes transitive dependencies that are not running', () => {
    const taskGraph = makeTaskGraph(
      {
        'app1:test': { project: 'app1', target: 'test' },
        'app1:lint': { project: 'app1', target: 'lint' },
        'app2:build': { project: 'app2', target: 'build' },
        'lib1:jar': { project: 'lib1', target: 'jar' },
        'lib2:jar': { project: 'lib2', target: 'jar' },
      },
      {
        'app1:test': ['app1:lint', 'app2:build'],
        'app2:build': ['lib1:jar'],
        'lib1:jar': ['lib2:jar'],
      }
    );
    const excludes = getExcludeTasksFromTaskGraph(
      ['app1:test'],
      new Set(['app1:test']),
      taskGraph,
      nodes
    );
    expect(excludes).toEqual(
      new Set([':app1:lint', ':app2:build', ':lib1:jar', ':lib2:jar'])
    );
  });

  it('does not exclude running tasks', () => {
    const taskGraph = makeTaskGraph(
      {
        'app1:test': { project: 'app1', target: 'test' },
        'app1:lint': { project: 'app1', target: 'lint' },
        'app2:build': { project: 'app2', target: 'build' },
      },
      {
        'app1:test': ['app1:lint', 'app2:build'],
      }
    );
    const excludes = getExcludeTasksFromTaskGraph(
      ['app1:test'],
      new Set(['app1:test', 'app1:lint', 'app2:build']),
      taskGraph,
      nodes
    );
    expect(excludes).toEqual(new Set());
  });

  it('skips tasks listed in includeDependsOnTasks', () => {
    const taskGraph = makeTaskGraph(
      {
        'app1:test': { project: 'app1', target: 'test' },
        'app1:lint': { project: 'app1', target: 'lint' },
        'app2:build': { project: 'app2', target: 'build' },
      },
      {
        'app1:test': ['app1:lint', 'app2:build'],
      }
    );
    const excludes = getExcludeTasksFromTaskGraph(
      ['app1:test'],
      new Set(['app1:test']),
      taskGraph,
      nodes,
      new Set([':app1:lint'])
    );
    expect(excludes).toEqual(new Set([':app2:build']));
  });

  it('ignores dependency ids not present in taskGraph.tasks', () => {
    const taskGraph = makeTaskGraph(
      {
        'app1:test': { project: 'app1', target: 'test' },
      },
      {
        'app1:test': ['ghost:task'],
      }
    );
    const excludes = getExcludeTasksFromTaskGraph(
      ['app1:test'],
      new Set(['app1:test']),
      taskGraph,
      nodes
    );
    expect(excludes).toEqual(new Set());
  });

  it('returns empty set when no starting ids', () => {
    const taskGraph = makeTaskGraph({}, {});
    const excludes = getExcludeTasksFromTaskGraph(
      [],
      new Set(),
      taskGraph,
      nodes
    );
    expect(excludes).toEqual(new Set());
  });

  it('skips deps with no taskName in the project graph', () => {
    const nodesWithoutTaskName: Record<string, ProjectGraphProjectNode> = {
      app1: {
        name: 'app1',
        type: 'app',
        data: {
          root: 'app1',
          targets: {
            test: { options: { taskName: ':app1:test' } },
            lint: {},
          },
        },
      },
    };
    const taskGraph = makeTaskGraph(
      {
        'app1:test': { project: 'app1', target: 'test' },
        'app1:lint': { project: 'app1', target: 'lint' },
      },
      {
        'app1:test': ['app1:lint'],
      }
    );
    const excludes = getExcludeTasksFromTaskGraph(
      ['app1:test'],
      new Set(['app1:test']),
      taskGraph,
      nodesWithoutTaskName
    );
    expect(excludes).toEqual(new Set());
  });
});

describe('getAllDependsOnFromTaskGraph', () => {
  it('returns transitive deps excluding starting ids', () => {
    const taskGraph = makeTaskGraph(
      {
        'a:build': { project: 'a', target: 'build' },
        'b:build': { project: 'b', target: 'build' },
        'c:build': { project: 'c', target: 'build' },
        'd:build': { project: 'd', target: 'build' },
      },
      {
        'a:build': ['b:build', 'c:build'],
        'b:build': ['d:build'],
      }
    );
    const deps = getAllDependsOnFromTaskGraph(['a:build'], taskGraph);
    expect(deps).toEqual(new Set(['b:build', 'c:build', 'd:build']));
  });

  it('handles cycles safely', () => {
    const taskGraph = makeTaskGraph(
      {
        'e:build': { project: 'e', target: 'build' },
        'f:build': { project: 'f', target: 'build' },
      },
      {
        'e:build': ['f:build'],
        'f:build': ['e:build'],
      }
    );
    const deps = getAllDependsOnFromTaskGraph(['e:build'], taskGraph);
    expect(deps).toEqual(new Set(['f:build']));
  });

  it('returns empty when task has no dependencies entry', () => {
    const taskGraph = makeTaskGraph(
      {
        'a:build': { project: 'a', target: 'build' },
      },
      {}
    );
    const deps = getAllDependsOnFromTaskGraph(['a:build'], taskGraph);
    expect(deps).toEqual(new Set());
  });

  it('does not include starting ids even if reachable via a cycle', () => {
    const taskGraph = makeTaskGraph(
      {
        'a:build': { project: 'a', target: 'build' },
        'b:build': { project: 'b', target: 'build' },
      },
      {
        'a:build': ['b:build'],
        'b:build': ['a:build'],
      }
    );
    const deps = getAllDependsOnFromTaskGraph(['a:build'], taskGraph);
    expect(deps).toEqual(new Set(['b:build']));
  });

  it('dedupes across multiple starting ids', () => {
    const taskGraph = makeTaskGraph(
      {
        'a:build': { project: 'a', target: 'build' },
        'b:build': { project: 'b', target: 'build' },
        'shared:build': { project: 'shared', target: 'build' },
      },
      {
        'a:build': ['shared:build'],
        'b:build': ['shared:build'],
      }
    );
    const deps = getAllDependsOnFromTaskGraph(
      ['a:build', 'b:build'],
      taskGraph
    );
    expect(deps).toEqual(new Set(['shared:build']));
  });
});
