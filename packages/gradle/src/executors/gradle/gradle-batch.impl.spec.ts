import { getGradlewTasksToRun } from './gradle-batch.impl';
import { TaskGraph, ProjectGraphProjectNode } from '@nx/devkit';
import { GradleExecutorSchema } from './schema';

describe('getGradlewTasksToRun', () => {
  let taskGraph: TaskGraph;
  let inputs: Record<string, GradleExecutorSchema>;
  let nodes: Record<string, ProjectGraphProjectNode>;

  beforeEach(() => {
    nodes = {
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
            lint: {
              options: { taskName: 'lintApp1' },
            },
          },
        },
      },
      app2: {
        name: 'app2',
        type: 'app',
        data: {
          root: 'app2',
          targets: {
            build: {
              dependsOn: [],
              options: { taskName: 'buildApp2' },
            },
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

    taskGraph = {
      tasks: {
        'app1:test': {
          id: 'app1:test',
          target: { project: 'app1', target: 'test' },
          outputs: [],
          overrides: {},
          projectRoot: 'app1',
          parallelism: false,
        },
        'app2:build': {
          id: 'app2:build',
          target: { project: 'app2', target: 'build' },
          outputs: [],
          overrides: {},
          projectRoot: 'app2',
          parallelism: false,
        },
      },
      dependencies: {},
      continuousDependencies: {},
      continueOnFailureDependencies: {},
      roots: ['app1:test', 'app2:build'],
    };

    inputs = {
      'app1:test': {
        taskName: 'test',
        excludeDependsOn: true,
      },
      'app2:build': {
        taskName: 'build',
        excludeDependsOn: false,
      },
    };
  });

  it('should correctly categorize tasks and their dependencies for exclusion', () => {
    const taskIds = ['app1:test', 'app2:build'];
    const result = getGradlewTasksToRun(taskIds, taskGraph, inputs, nodes);

    expect(result.gradlewTasksToRun).toEqual({
      'app1:test': inputs['app1:test'],
      'app2:build': inputs['app2:build'],
    });
    expect(result.excludeTasks).toEqual(new Set(['lintApp1']));
    expect(result.excludeTestTasks).toEqual(new Set());
  });

  it('should handle tasks with no excludeDependsOn', () => {
    inputs['app1:test'].excludeDependsOn = false;
    const taskIds = ['app1:test', 'app2:build'];
    const result = getGradlewTasksToRun(taskIds, taskGraph, inputs, nodes);

    expect(result.excludeTasks).toEqual(new Set());
    expect(result.excludeTestTasks).toEqual(new Set());
  });

  it('should handle testClassName for excludeTestTasks', () => {
    inputs['app1:test'].testClassName = 'com.example.MyTestClass';
    const taskIds = ['app1:test'];
    const result = getGradlewTasksToRun(taskIds, taskGraph, inputs, nodes);

    expect(result.excludeTasks).toEqual(new Set());
    // Test task's dependsOn should be added to excludeTestTasks if testClassName is present
    expect(result.excludeTestTasks).toEqual(new Set(['buildApp2', 'lintApp1']));
  });

  it('should include all dependencies when excludeDependsOn is false for a task', () => {
    inputs = {
      'app1:test': {
        taskName: 'test',
        excludeDependsOn: false,
      },
    };
    const taskIds = ['app1:test'];
    const result = getGradlewTasksToRun(taskIds, taskGraph, inputs, nodes);

    // Since excludeDependsOn is false, no tasks should be excluded via excludeTasks
    // This part of the logic is used for `allDependsOn` to correctly calculate runningTaskIds
    // for `getExcludeTasks` later.
    // In this specific test, we're not checking `allDependsOn` directly, but the outcome
    // on `excludeTasks` confirms its effect (or lack thereof due to `excludeDependsOn: false`).
    expect(result.excludeTasks).toEqual(new Set());
    expect(result.excludeTestTasks).toEqual(new Set());
  });

  it('should correctly handle a mix of excludeDependsOn true and false', () => {
    taskGraph.tasks['app3:deploy'] = {
      id: 'app3:deploy',
      target: { project: 'app3', target: 'deploy' },
      outputs: [],
      overrides: {},
      projectRoot: 'app3',
      parallelism: false,
    };
    taskGraph.roots.push('app3:deploy');
    inputs['app3:deploy'] = {
      taskName: 'deploy',
      excludeDependsOn: true,
    };

    const taskIds = ['app1:test', 'app2:build', 'app3:deploy'];
    const result = getGradlewTasksToRun(taskIds, taskGraph, inputs, nodes);

    expect(result.gradlewTasksToRun).toEqual({
      'app1:test': inputs['app1:test'],
      'app2:build': inputs['app2:build'],
      'app3:deploy': inputs['app3:deploy'],
    });

    // app1:test (excludeDependsOn: true) -> exclude lintApp1
    // app3:deploy (excludeDependsOn: true) -> depends on app1:test
    //   Since app1:test is also running, 'testApp1' should not be excluded.
    //   However, 'lintApp1' and 'buildApp2' (dependencies of 'app1:test') should be excluded.
    expect(result.excludeTasks).toEqual(new Set(['lintApp1']));
    expect(result.excludeTestTasks).toEqual(new Set());
  });
});
