import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectGraph } from '../config/project-graph';
import { Task } from '../config/task-graph';
import {
  getEnvFilesForTask,
  getEnvVariablesForTask,
  loadAndExpandDotEnvFile,
} from './task-env';

describe('NX_INVOCATION_ROOT_PID', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NX_INVOCATION_ROOT_PID;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function makeTask(
    project: string,
    target: string,
    configuration?: string
  ): Task {
    let id = `${project}:${target}`;
    if (configuration) {
      id += `:${configuration}`;
    }
    return {
      id,
      target: { project, target, configuration },
      overrides: {},
      outputs: [],
      projectRoot: `libs/${project}`,
    } as any as Task;
  }

  it('should set NX_INVOCATION_ROOT_PID to current process PID when no existing root PID', () => {
    const task = makeTask('workspace', 'dev');
    const env = getEnvVariablesForTask(
      task,
      {},
      'true',
      false,
      false,
      '',
      false
    );
    expect(env.NX_INVOCATION_ROOT_PID).toBe(String(process.pid));
  });

  it('should preserve NX_INVOCATION_ROOT_PID from parent Nx process', () => {
    process.env.NX_INVOCATION_ROOT_PID = '12345';
    const task = makeTask('workspace', 'dev');
    const env = getEnvVariablesForTask(
      task,
      {},
      'true',
      false,
      false,
      '',
      false
    );
    expect(env.NX_INVOCATION_ROOT_PID).toBe('12345');
  });
});

describe(loadAndExpandDotEnvFile.name, () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should support chained variable expansion across multiple env files', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-task-env-'));

    const firstFile = join(tempDir, '.env.local');
    const secondFile = join(tempDir, '.local.env');
    const thirdFile = join(tempDir, '.env');

    writeFileSync(firstFile, 'BASE_URL=https://nx.dev\n');
    writeFileSync(secondFile, 'API_URL=$BASE_URL/api\n');
    writeFileSync(thirdFile, 'FULL_URL=$API_URL/v1\n');

    const environmentVariables: NodeJS.ProcessEnv = {};

    loadAndExpandDotEnvFile(
      [firstFile, secondFile, thirdFile],
      environmentVariables
    );

    expect(environmentVariables).toMatchObject({
      BASE_URL: 'https://nx.dev',
      API_URL: 'https://nx.dev/api',
      FULL_URL: 'https://nx.dev/api/v1',
    });
  });

  it('should support back-referenced chains from third file to second to first', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-task-env-'));

    const firstFile = join(tempDir, '.env.local');
    const secondFile = join(tempDir, '.local.env');
    const thirdFile = join(tempDir, '.env');

    writeFileSync(firstFile, 'FULL_URL=$API_URL/v1\n');
    writeFileSync(secondFile, 'API_URL=$BASE_URL/api\n');
    writeFileSync(thirdFile, 'BASE_URL=https://nx.dev\n');

    const environmentVariables: NodeJS.ProcessEnv = {};

    // Load in declared priority order while allowing references to values
    // that are defined in later files.
    loadAndExpandDotEnvFile(
      [firstFile, secondFile, thirdFile],
      environmentVariables
    );

    expect(environmentVariables).toMatchObject({
      BASE_URL: 'https://nx.dev',
      API_URL: 'https://nx.dev/api',
      FULL_URL: 'https://nx.dev/api/v1',
    });
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
