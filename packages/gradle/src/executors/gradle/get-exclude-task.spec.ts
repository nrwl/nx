import { getExcludeTasks, getAllDependsOn } from './get-exclude-task';
import { Target } from '@nx/devkit';

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

  it('should handle recursive dependencies', () => {
    const targets = new Set<Target>([createTarget('app3', 'deploy')]);
    const runningTasks = new Set<Target>([createTarget('app3', 'deploy')]);
    const excludes = getExcludeTasks(targets, nodes, runningTasks);
    expect(excludes).toEqual(new Set(['testApp1']));
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

describe('getAllDependsOn', () => {
  const nodes: any = {
    a: {
      name: 'a',
      type: 'lib',
      data: {
        root: 'a',
        targets: {
          build: {
            dependsOn: [
              { target: 'build', projects: ['b'] },
              { target: 'build', projects: ['c'] },
            ],
          },
        },
      },
    },
    b: {
      name: 'b',
      type: 'lib',
      data: {
        root: 'b',
        targets: {
          build: { dependsOn: [{ target: 'build', projects: ['d'] }] },
        },
      },
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
      data: {
        root: 'e',
        targets: {
          build: { dependsOn: [{ target: 'build', projects: ['f'] }] },
        },
      },
    },
    f: {
      name: 'f',
      type: 'lib',
      data: {
        root: 'f',
        targets: {
          build: { dependsOn: [{ target: 'build', projects: ['e'] }] },
        },
      },
    },
  };

  it('should return all transitive dependencies excluding the starting task', () => {
    const dependencies = getAllDependsOn(nodes, 'a', 'build');
    expect(dependencies).toEqual(
      new Set([
        createTarget('b', 'build'),
        createTarget('c', 'build'),
        createTarget('d', 'build'),
      ])
    );
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
    expect(dependencies).toEqual(new Set([createTarget('f', 'build')]));
  });

  it('should not include the starting task in the result', () => {
    const dependencies = getAllDependsOn(nodes, 'a', 'build');
    const hasStart = Array.from(dependencies).some(
      (d) => d.project === 'a' && d.target === 'build'
    );
    expect(hasStart).toBe(false);
  });

  it('should handle object-format dependsOn entries', () => {
    const objectNodes: any = {
      app: {
        name: 'app',
        type: 'app',
        data: {
          root: 'app',
          targets: {
            build: {
              dependsOn: [
                { target: 'compileJava' },
                { target: 'jar', projects: ['lib'] },
              ],
            },
            compileJava: {},
          },
        },
      },
      lib: {
        name: 'lib',
        type: 'lib',
        data: { root: 'lib', targets: { jar: {} } },
      },
    };
    const dependencies = getAllDependsOn(objectNodes, 'app', 'build');
    expect(dependencies).toEqual(
      new Set([createTarget('app', 'compileJava'), createTarget('lib', 'jar')])
    );
  });
});
