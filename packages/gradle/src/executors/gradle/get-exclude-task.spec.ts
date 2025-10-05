import { getExcludeTasks, getAllDependsOn } from './get-exclude-task';

describe('getExcludeTasks', () => {
  const nodes: any = {
    app1: {
      name: 'app1',
      type: 'app',
      data: {
        root: 'app1',
        targets: {
          test: {
            dependsOn: ['app1:lint', 'app2:build'],
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
            dependsOn: ['app1:test'],
            options: { taskName: 'deployApp3' },
          },
        },
      },
    },
  };

  it('should exclude tasks that are not in runningTaskIds and have excludeDependsOn true', () => {
    const targets = new Set<string>(['app1:test', 'app2:build']);
    const runningTaskIds = new Set<string>(['app1:test']);
    const excludes = getExcludeTasks(targets, nodes, runningTaskIds);
    expect(excludes).toEqual(new Set(['lintApp1', 'buildApp2']));
  });

  it('should not exclude tasks if direct dependencies are running', () => {
    const targets = new Set<string>(['app1:test']);
    const runningTaskIds = new Set<string>([
      'app1:test',
      'app1:lint',
      'app2:build',
    ]);
    const excludes = getExcludeTasks(targets, nodes, runningTaskIds);
    expect(excludes).toEqual(new Set());
  });

  it('should handle targets with no dependencies', () => {
    const targets = new Set<string>(['app2:build']);
    const runningTaskIds = new Set<string>(['app2:build']);
    const excludes = getExcludeTasks(targets, nodes, runningTaskIds);
    expect(excludes).toEqual(new Set());
  });

  it('should handle missing project or target', () => {
    const targets = new Set<string>(['nonexistent:test']);
    const runningTaskIds = new Set<string>();
    const excludes = getExcludeTasks(targets, nodes, runningTaskIds);
    expect(excludes).toEqual(new Set());
  });

  it('should handle dependencies that are also running tasks', () => {
    const targets = new Set<string>(['app1:test']);
    const runningTaskIds = new Set<string>(['app1:test', 'app1:lint']);
    const excludes = getExcludeTasks(targets, nodes, runningTaskIds);
    expect(excludes).toEqual(new Set(['buildApp2']));
  });

  it('should handle recursive dependencies', () => {
    // Assuming app3:deploy depends on app1:test, which in turn depends on app1:lint and app2:build
    const targets = new Set<string>(['app3:deploy']);
    const runningTaskIds = new Set<string>(['app3:deploy']);
    const excludes = getExcludeTasks(targets, nodes, runningTaskIds);
    expect(excludes).toEqual(new Set(['testApp1']));
  });
});

describe('getAllDependsOn', () => {
  const nodes: any = {
    a: {
      name: 'a',
      type: 'lib',
      data: {
        root: 'a',
        targets: { build: { dependsOn: ['b:build', 'c:build'] } },
      },
    },
    b: {
      name: 'b',
      type: 'lib',
      data: { root: 'b', targets: { build: { dependsOn: ['d:build'] } } },
    },
    c: {
      name: 'c',
      type: 'lib',
      data: { root: 'c', targets: { build: {} } },
    },
    d: {
      name: 'd',
      type: 'lib',
      data: { root: 'd', targets: { build: {} } },
    },
    e: {
      name: 'e',
      type: 'lib',
      data: { root: 'e', targets: { build: { dependsOn: ['f:build'] } } },
    },
    f: {
      name: 'f',
      type: 'lib',
      data: { root: 'f', targets: { build: { dependsOn: ['e:build'] } } }, // Circular dependency
    },
  };

  it('should return all transitive dependencies excluding the starting task', () => {
    const dependencies = getAllDependsOn(nodes, 'a', 'build');
    expect(dependencies).toEqual(new Set(['b:build', 'c:build', 'd:build']));
  });

  it('should handle no dependencies', () => {
    const dependencies = getAllDependsOn(nodes, 'c', 'build');
    expect(dependencies).toEqual(new Set());
  });

  it('should handle missing project or target', () => {
    const dependencies = getAllDependsOn(nodes, 'nonexistent', 'build');
    expect(dependencies).toEqual(new Set());
  });

  it('should handle circular dependencies gracefully', () => {
    const dependencies = getAllDependsOn(nodes, 'e', 'build');
    expect(dependencies).toEqual(new Set(['f:build']));
  });

  it('should not include the starting task in the result', () => {
    const dependencies = getAllDependsOn(nodes, 'a', 'build');
    expect(dependencies).not.toContain('a:build');
  });
});
