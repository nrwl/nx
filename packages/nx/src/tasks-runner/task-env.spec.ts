import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectGraph } from '../config/project-graph';
import { Task } from '../config/task-graph';
import { setWorkspaceRoot, workspaceRoot } from '../utils/workspace-root';
import {
  getEnvFilesForTask,
  getEnvVariablesForTask,
  getForceColorForChild,
  getGraphTimeDotEnvForTask,
  getTaskSpecificEnv,
  loadAndExpandDotEnvFile,
  unloadDotEnvFile,
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

  // The parse cache must hold the *raw* (pre-expansion) key=value pairs.
  // `dotenv-expand` mutates the `parsed` object it is handed in place, so
  // handing it the cached object would bake the first caller's substitutions
  // into every subsequent read of the same file.
  it('should expand against each callers env when the same file is read twice', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-task-env-'));
    const envFile = join(tempDir, '.env');
    writeFileSync(
      envFile,
      'GREETING=hello-${WHO}\nENDPOINT=http://${HOST}:3000\n'
    );

    const first: NodeJS.ProcessEnv = { WHO: 'alice', HOST: 'alpha' };
    loadAndExpandDotEnvFile(envFile, first);

    // Second call hits the parse cache (same path, unchanged mtime).
    const second: NodeJS.ProcessEnv = { WHO: 'bob', HOST: 'beta' };
    loadAndExpandDotEnvFile(envFile, second);

    expect(first).toMatchObject({
      GREETING: 'hello-alice',
      ENDPOINT: 'http://alpha:3000',
    });
    expect(second).toMatchObject({
      GREETING: 'hello-bob',
      ENDPOINT: 'http://beta:3000',
    });
  });

  // Mirrors `run-commands`' `loadEnvVarsFile`, which unloads then loads the same
  // file. `unloadDotEnvFile` expands against a throwaway empty env, so a cache
  // that stored expanded values would leave every `${...}` resolved to ''.
  it('should expand correctly when a file is unloaded and then loaded (envFile)', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-task-env-'));
    const envFile = join(tempDir, '.env');
    writeFileSync(
      envFile,
      'GREETING=hello-${WHO}\nENDPOINT=http://${HOST}:3000\n'
    );

    const env: NodeJS.ProcessEnv = { WHO: 'alice', HOST: 'alpha' };
    unloadDotEnvFile(envFile, env);
    loadAndExpandDotEnvFile(envFile, env);

    expect(env).toMatchObject({
      GREETING: 'hello-alice',
      ENDPOINT: 'http://alpha:3000',
    });
  });
  it('skips candidate files that do not exist and still loads the ones that do', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-task-env-'));
    const present = join(tempDir, '.env');
    writeFileSync(present, 'FROM_FILE=yes\n');

    const environmentVariables: NodeJS.ProcessEnv = {};
    const result = loadAndExpandDotEnvFile(
      [join(tempDir, '.env.build.local'), present, join(tempDir, '.env.build')],
      environmentVariables
    );

    expect(environmentVariables.FROM_FILE).toBe('yes');
    expect(result.error).toBeUndefined();

    // The same list again is served from the parse cache.
    const again: NodeJS.ProcessEnv = {};
    loadAndExpandDotEnvFile(
      [join(tempDir, '.env.build.local'), present],
      again
    );
    expect(again.FROM_FILE).toBe('yes');
  });

  it('keeps the dotenv error for a single named file that is missing', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-task-env-'));

    const result = loadAndExpandDotEnvFile(join(tempDir, '.env.missing'), {});

    expect((result.error as NodeJS.ErrnoException)?.code).toBe('ENOENT');
  });

  it('returns an empty parse when no file in the list exists', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-task-env-'));
    const environmentVariables: NodeJS.ProcessEnv = { KEEP: '1' };

    const result = loadAndExpandDotEnvFile(
      [join(tempDir, '.env.a'), join(tempDir, '.env.b')],
      environmentVariables
    );

    expect(result.parsed).toEqual({});
    expect(result.error).toBeUndefined();
    expect(environmentVariables).toEqual({ KEEP: '1' });
  });
});

describe(getTaskSpecificEnv.name, () => {
  const originalEnv = process.env;
  const originalWorkspaceRoot = workspaceRoot;
  let tempDir: string;

  const graph = {
    nodes: {
      p: {
        name: 'p',
        type: 'lib',
        data: { root: 'p', targets: { build: {} } },
      },
    },
    dependencies: {},
  } as unknown as ProjectGraph;
  const task = (id: string) =>
    ({
      id,
      target: { project: 'p', target: 'build' },
      projectRoot: 'p',
      overrides: {},
      outputs: [],
    }) as unknown as Task;

  beforeEach(() => {
    process.env = { ...originalEnv };
    tempDir = mkdtempSync(join(tmpdir(), 'nx-task-env-'));
    setWorkspaceRoot(tempDir);
  });

  afterEach(() => {
    process.env = originalEnv;
    setWorkspaceRoot(originalWorkspaceRoot);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('unloads the root dotenv files, and re-reads them once they change', () => {
    writeFileSync(join(tempDir, '.env'), 'ROOT_ONLY=first\n');
    process.env.ROOT_ONLY = 'first';
    expect(
      getTaskSpecificEnv(task('p:build:a'), graph).ROOT_ONLY
    ).toBeUndefined();

    // A different length so the stat signature changes even within one tick.
    writeFileSync(join(tempDir, '.env'), 'ROOT_ONLY=second-value\n');
    process.env.ROOT_ONLY = 'second-value';
    expect(
      getTaskSpecificEnv(task('p:build:b'), graph).ROOT_ONLY
    ).toBeUndefined();

    // A value the file no longer defines is kept.
    rmSync(join(tempDir, '.env'));
    expect(getTaskSpecificEnv(task('p:build:c'), graph).ROOT_ONLY).toBe(
      'second-value'
    );
  });

  it('hands every task its own copy of the base env', () => {
    const a = getTaskSpecificEnv(task('p:build:x'), graph);
    const b = getTaskSpecificEnv(task('p:build:y'), graph);
    expect(a).not.toBe(b);
    a.MUTATED = '1';
    expect(b.MUTATED).toBeUndefined();
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
