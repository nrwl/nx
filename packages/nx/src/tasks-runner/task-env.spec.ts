import { getEnvFilesForTask } from './task-env';
import { Task } from '../config/task-graph';
import { ProjectGraph } from '../config/project-graph';

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
