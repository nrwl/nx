import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectGraph } from '../config/project-graph';
import { Task } from '../config/task-graph';
import { setWorkspaceRoot, workspaceRoot } from '../utils/workspace-root';
import {
  getEnvFilesForTask,
  getEnvVariablesForBatchProcess,
  getEnvVariablesForTask,
  getForceColorForChild,
  getGraphTimeDotEnvForTask,
  getInvocationAncestorPids,
  loadAndExpandDotEnvFile,
} from './task-env';

describe('invocation tracking env vars', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NX_INVOCATION_ROOT_PID;
    delete process.env.NX_INVOCATION_ANCESTOR_PIDS;
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

  it('should append the current PID to NX_INVOCATION_ANCESTOR_PIDS', () => {
    const task = makeTask('workspace', 'dev');

    expect(
      getEnvVariablesForTask(task, {}, 'true', false, false, '', false)
        .NX_INVOCATION_ANCESTOR_PIDS
    ).toBe(String(process.pid));

    process.env.NX_INVOCATION_ANCESTOR_PIDS = '123';
    expect(
      getEnvVariablesForTask(task, {}, 'true', false, false, '', false)
        .NX_INVOCATION_ANCESTOR_PIDS
    ).toBe(`123,${process.pid}`);
  });

  it('should set both invocation vars for batch processes', () => {
    expect(getEnvVariablesForBatchProcess(false, false)).toMatchObject({
      NX_INVOCATION_ROOT_PID: String(process.pid),
      NX_INVOCATION_ANCESTOR_PIDS: String(process.pid),
    });

    process.env.NX_INVOCATION_ROOT_PID = '12345';
    process.env.NX_INVOCATION_ANCESTOR_PIDS = '12345';
    expect(getEnvVariablesForBatchProcess(false, false)).toMatchObject({
      NX_INVOCATION_ROOT_PID: '12345',
      NX_INVOCATION_ANCESTOR_PIDS: `12345,${process.pid}`,
    });
  });

  it('should read back the ancestor chain it writes', () => {
    process.env.NX_INVOCATION_ANCESTOR_PIDS = '123';
    const child = getEnvVariablesForTask(
      makeTask('workspace', 'dev'),
      {},
      'true',
      false,
      false,
      '',
      false
    );

    process.env.NX_INVOCATION_ANCESTOR_PIDS = child.NX_INVOCATION_ANCESTOR_PIDS;
    expect(getInvocationAncestorPids()).toEqual([123, process.pid]);
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
  it('should ignore target group members the project does not define', () => {
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
            metadata: {
              targetGroups: {
                build: ['build', 'phantomTarget'],
              },
            },
          },
        },
      },
    } as any as ProjectGraph;
    expect(() => getEnvFilesForTask(task, graph)).not.toThrow();
    expect(getEnvFilesForTask(task, graph)).toEqual(
      getEnvFilesForTask(task, {
        nodes: {
          'test-project': { data: { targets: { build: {} } } },
        },
      } as any as ProjectGraph)
    );
  });
});

describe('getGraphTimeDotEnvForTask', () => {
  const originalEnv = process.env;
  const originalWorkspaceRoot = workspaceRoot;
  let tempDir: string;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // The 'true' marker is only stamped once the graph exists; graph-time
    // resolution must not depend on it being set.
    delete process.env.NX_LOAD_DOT_ENV_FILES;
    delete process.env.BASE_URL;
    tempDir = mkdtempSync(join(tmpdir(), 'nx-graph-env-'));
    setWorkspaceRoot(tempDir);
  });

  afterEach(() => {
    process.env = originalEnv;
    setWorkspaceRoot(originalWorkspaceRoot);
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('loads a target-scoped .env before the run-time marker is stamped', () => {
    writeFileSync(
      join(tempDir, '.env.e2e'),
      'BASE_URL=http://localhost:4301\n'
    );

    const env = getGraphTimeDotEnvForTask('.', 'e2e');

    expect(env.BASE_URL).toBe('http://localhost:4301');
  });

  it('resolves a task-scoped value shadowed by an ambient root .env variable', () => {
    // At Nx init the root .env was loaded into the ambient env. Reconstruction
    // must unload it so the task-scoped file wins the way it does at run time:
    // dotenv loading never overrides a key that is already set.
    writeFileSync(join(tempDir, '.env'), 'BASE_URL=http://localhost:4200\n');
    process.env.BASE_URL = 'http://localhost:4200';
    writeFileSync(
      join(tempDir, '.env.e2e'),
      'BASE_URL=http://localhost:4301\n'
    );

    const env = getGraphTimeDotEnvForTask('.', 'e2e');

    expect(env.BASE_URL).toBe('http://localhost:4301');
  });

  it('does not load dotenv files when NX_LOAD_DOT_ENV_FILES is "false"', () => {
    process.env.NX_LOAD_DOT_ENV_FILES = 'false';
    writeFileSync(
      join(tempDir, '.env.e2e'),
      'BASE_URL=http://localhost:4301\n'
    );

    const env = getGraphTimeDotEnvForTask('.', 'e2e');

    expect(env.BASE_URL).toBeUndefined();
  });

  it('honors the opt-out from the live env when the base env snapshot lacks it', () => {
    // Windows resolves process.env case-insensitively while a plain snapshot
    // keeps whichever spelling was exported, so a lowercase opt-out is absent
    // from the snapshot the playwright plugin passes but live all the same.
    process.env.NX_LOAD_DOT_ENV_FILES = 'false';
    writeFileSync(
      join(tempDir, '.env.e2e'),
      'BASE_URL=http://localhost:4301\n'
    );
    const snapshotWithoutTheKey = { ...process.env };
    delete snapshotWithoutTheKey.NX_LOAD_DOT_ENV_FILES;

    const env = getGraphTimeDotEnvForTask(
      '.',
      'e2e',
      undefined,
      undefined,
      snapshotWithoutTheKey
    );

    expect(env.BASE_URL).toBeUndefined();
  });

  it('bases the reconstruction on the given base env, not the live process.env', () => {
    // A caller running config files in-process passes the snapshot it took
    // under its load lock; a concurrent load's transient write to the live env
    // must not be read as ambient, where it would mask the task file's value.
    writeFileSync(
      join(tempDir, '.env.e2e'),
      'BASE_URL=http://localhost:4301\n'
    );
    const snapshot = { ...process.env };
    process.env.BASE_URL = 'http://localhost:9999';

    const env = getGraphTimeDotEnvForTask(
      '.',
      'e2e',
      undefined,
      undefined,
      snapshot
    );

    expect(env.BASE_URL).toBe('http://localhost:4301');
  });
});

describe('getForceColorForChild', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should return FORCE_COLOR when it is explicitly set', () => {
    process.env.FORCE_COLOR = '1';
    delete process.env.NX_ORIGINAL_FORCE_COLOR;
    expect(getForceColorForChild()).toBe('1');
  });

  it('should return "0" when NX_ORIGINAL_FORCE_COLOR is "0" and FORCE_COLOR was deleted', () => {
    delete process.env.FORCE_COLOR;
    process.env.NX_ORIGINAL_FORCE_COLOR = '0';
    expect(getForceColorForChild()).toBe('0');
  });

  it('should default to "true" when neither FORCE_COLOR nor NX_ORIGINAL_FORCE_COLOR is set', () => {
    delete process.env.FORCE_COLOR;
    delete process.env.NX_ORIGINAL_FORCE_COLOR;
    expect(getForceColorForChild()).toBe('true');
  });

  it('should prefer FORCE_COLOR over NX_ORIGINAL_FORCE_COLOR when both are set', () => {
    process.env.FORCE_COLOR = '3';
    process.env.NX_ORIGINAL_FORCE_COLOR = '0';
    expect(getForceColorForChild()).toBe('3');
  });
});
