import {
  getExcludeTasksFromTaskGraph,
  getAllDependsOnFromTaskGraph,
} from './get-exclude-task';
import { ProjectGraphProjectNode, Target, TaskGraph } from '@nx/devkit';

function makeTaskGraph(
  tasks: Record<string, Target>,
  dependencies: Record<string, string[]> = {},
  continuousDependencies: Record<string, string[]> = {}
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
    continuousDependencies,
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

  it('includes deps reachable only via continuousDependencies', () => {
    const taskGraph = makeTaskGraph(
      {
        'a:build': { project: 'a', target: 'build' },
        'b:serve': { project: 'b', target: 'serve' },
      },
      {
        'a:build': [],
      },
      {
        'a:build': ['b:serve'],
      }
    );
    const deps = getAllDependsOnFromTaskGraph(['a:build'], taskGraph);
    expect(deps).toEqual(new Set(['b:serve']));
  });

  it('walks transitive continuousDependencies through regular deps', () => {
    const taskGraph = makeTaskGraph(
      {
        'a:build': { project: 'a', target: 'build' },
        'b:build': { project: 'b', target: 'build' },
        'c:serve': { project: 'c', target: 'serve' },
        'd:build': { project: 'd', target: 'build' },
      },
      {
        'a:build': ['b:build'],
        'c:serve': ['d:build'],
      },
      {
        'b:build': ['c:serve'],
      }
    );
    const deps = getAllDependsOnFromTaskGraph(['a:build'], taskGraph);
    expect(deps).toEqual(new Set(['b:build', 'c:serve', 'd:build']));
  });

  it('handles cycles via continuousDependencies safely', () => {
    const taskGraph = makeTaskGraph(
      {
        'a:serve': { project: 'a', target: 'serve' },
        'b:serve': { project: 'b', target: 'serve' },
      },
      {},
      {
        'a:serve': ['b:serve'],
        'b:serve': ['a:serve'],
      }
    );
    const deps = getAllDependsOnFromTaskGraph(['a:serve'], taskGraph);
    expect(deps).toEqual(new Set(['b:serve']));
  });
});
