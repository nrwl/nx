import { ProjectGraph } from '../config/project-graph';
import { Task } from '../config/task-graph';
import { getEnvFilesForTask, getEnvVariablesForTask } from './task-env';

describe('NX_TASK_INVOCATION_CHAIN', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NX_TASK_INVOCATION_CHAIN;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function makeTask(project: string, target: string): Task {
    return {
      id: `${project}:${target}`,
      target: { project, target },
      overrides: {},
      outputs: [],
      projectRoot: `libs/${project}`,
    } as any as Task;
  }

  it('should set the chain to the task key when no existing chain exists', () => {
    const task = makeTask('workspace', 'dev');
    const env = getEnvVariablesForTask(
      task,
      {},
      'true',
      false,
      false,
      null,
      null
    );
    expect(env.NX_TASK_INVOCATION_CHAIN).toMatchInlineSnapshot(
      `"$0 -> workspace:dev"`
    );
  });

  it('should append to the existing chain from a parent Nx process', () => {
    process.env.NX_TASK_INVOCATION_CHAIN = '$0 -> workspace:dev';
    const task = makeTask('workspace', 'watch');
    const env = getEnvVariablesForTask(
      task,
      {},
      'true',
      false,
      false,
      null,
      null
    );
    expect(env.NX_TASK_INVOCATION_CHAIN).toMatchInlineSnapshot(
      `"$0 -> workspace:dev -> workspace:watch"`
    );
  });

  it('should accumulate deeply nested chains', () => {
    process.env.NX_TASK_INVOCATION_CHAIN = '$0 -> a:build -> b:dev';
    const task = makeTask('c', 'serve');
    const env = getEnvVariablesForTask(
      task,
      {},
      'true',
      false,
      false,
      null,
      null
    );
    expect(env.NX_TASK_INVOCATION_CHAIN).toMatchInlineSnapshot(
      `"$0 -> a:build -> b:dev -> c:serve"`
    );
  });
});

describe('getEnvFilesForTask', () => {
  it('should return the correct env files for a standard task', () => {
    const task = {
      projectRoot: 'libs/test-project',
      target: {
        project: 'test-project',
        target: 'build',
      },
    } as any as Task;
    const graph = {
      nodes: {
        'test-project': {
          data: {
            targets: {
              build: {},
            },
          },
        },
      },
    } as any as ProjectGraph;
    const envFiles = getEnvFilesForTask(task, graph);
    expect(envFiles).toMatchSnapshot();
  });
  it('should return the correct env files for a standard task with configurations', () => {
    const task = {
      projectRoot: 'libs/test-project',
      target: {
        project: 'test-project',
        target: 'build',
        configuration: 'development',
      },
    } as any as Task;
    const graph = {
      nodes: {
        'test-project': {
          data: {
            targets: {
              build: {
                configurations: {
                  development: {},
                },
              },
            },
          },
        },
      },
    } as any as ProjectGraph;
    const envFiles = getEnvFilesForTask(task, graph);
    expect(envFiles).toMatchSnapshot();
  });
  it('should return the correct env files for an atomized task', () => {
    const task = {
      projectRoot: 'libs/test-project',
      target: {
        project: 'test-project',
        target: 'e2e-ci--i/am/atomized',
      },
    } as any as Task;
    const graph = {
      nodes: {
        'test-project': {
          data: {
            targets: {
              'e2e-ci--i/am/atomized': {},
              'e2e-ci--tests/run-me.spec.ts': {},
              'e2e-ci--tests/run-me-2.spec.ts': {},
              'e2e-ci--merge-reports': {},
              'e2e-ci': {
                metadata: {
                  nonAtomizedTarget: 'e2e',
                },
              },
              e2e: {},
            },
            metadata: {
              targetGroups: {
                'E2E (CI)': [
                  'e2e-ci--i/am/atomized',
                  'e2e-ci--tests/run-me.spec.ts',
                  'e2e-ci--tests/run-me-2.spec.ts',
                  'e2e-ci--merge-reports',
                  'e2e-ci',
                ],
              },
            },
          },
        },
      },
    } as any as ProjectGraph;
    const envFiles = getEnvFilesForTask(task, graph);
    expect(envFiles).toMatchSnapshot();
  });
  it('should return the correct env files for an atomized task with configurations', () => {
    const task = {
      projectRoot: 'libs/test-project',
      target: {
        project: 'test-project',
        target: 'e2e-ci--i/am/atomized',
        configuration: 'staging',
      },
    } as any as Task;
    const graph = {
      nodes: {
        'test-project': {
          data: {
            targets: {
              'e2e-ci--i/am/atomized': {
                configurations: {
                  staging: {},
                },
              },
              'e2e-ci--tests/run-me.spec.ts': {},
              'e2e-ci--tests/run-me-2.spec.ts': {},
              'e2e-ci--merge-reports': {},
              'e2e-ci': {
                metadata: {
                  nonAtomizedTarget: 'e2e',
                },
              },
              e2e: {},
            },
            metadata: {
              targetGroups: {
                'E2E (CI)': [
                  'e2e-ci--i/am/atomized',
                  'e2e-ci--tests/run-me.spec.ts',
                  'e2e-ci--tests/run-me-2.spec.ts',
                  'e2e-ci--merge-reports',
                  'e2e-ci',
                ],
              },
            },
          },
        },
      },
    } as any as ProjectGraph;
    const envFiles = getEnvFilesForTask(task, graph);
    expect(envFiles).toMatchSnapshot();
  });
});
