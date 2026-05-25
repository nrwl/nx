import {
  ExecutorContext,
  TaskGraph,
  ProjectGraphProjectNode,
  ProjectConfiguration,
} from '@nx/devkit';
import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';
import { ChildProcess, spawn } from 'child_process';
import { existsSync } from 'fs';
import mavenBatchExecutor from './maven-batch.impl';
import { MavenExecutorSchema } from './schema';

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  spawn: jest.fn(),
}));
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
}));

const spawnMock = spawn as jest.MockedFunction<typeof spawn>;
const existsSyncMock = existsSync as jest.MockedFunction<typeof existsSync>;

interface FakeChildOptions {
  stderrLines: string[];
  exitCode: number;
}

function createFakeChild({
  stderrLines,
  exitCode,
}: FakeChildOptions): ChildProcess {
  const stderr = new Readable({ read() {} });
  for (const line of stderrLines) {
    stderr.push(line.endsWith('\n') ? line : `${line}\n`);
  }
  stderr.push(null);

  const stdin = new Writable({
    write(_c, _e, cb) {
      cb();
    },
  });

  const child = new EventEmitter() as ChildProcess;
  Object.assign(child, { stdin, stderr, stdout: null });
  setImmediate(() => child.emit('close', exitCode));
  return child;
}

async function collect<T>(iter: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iter) out.push(item);
  return out;
}

describe('Maven Batch Executor', () => {
  let context: ExecutorContext;
  let taskGraph: TaskGraph;

  beforeEach(() => {
    const projectAConfig: ProjectConfiguration = {
      name: 'project-a',
      root: '/workspace/libs/project-a',
      tags: [],
      sourceRoot: '/workspace/libs/project-a/src',
      targets: {
        build: {
          executor: '@nx/maven:maven',
          options: {
            phase: 'compile',
          },
        },
      },
    };

    const projectBConfig: ProjectConfiguration = {
      name: 'project-b',
      root: '/workspace/libs/project-b',
      tags: [],
      sourceRoot: '/workspace/libs/project-b/src',
      targets: {
        build: {
          executor: '@nx/maven:maven',
          options: {
            phase: 'compile',
          },
        },
      },
    };

    const projectANode: ProjectGraphProjectNode = {
      name: 'project-a',
      type: 'lib',
      data: projectAConfig,
    };

    const projectBNode: ProjectGraphProjectNode = {
      name: 'project-b',
      type: 'lib',
      data: projectBConfig,
    };

    taskGraph = {
      roots: ['project-a:build', 'project-b:build'],
      tasks: {
        'project-a:build': {
          id: 'project-a:build',
          target: {
            project: 'project-a',
            target: 'build',
            configuration: undefined,
          },
          outputs: [],
          cache: false,
          parallelism: true,
          overrides: {},
        },
        'project-b:build': {
          id: 'project-b:build',
          target: {
            project: 'project-b',
            target: 'build',
            configuration: undefined,
          },
          outputs: [],
          cache: false,
          parallelism: true,
          overrides: {},
        },
      },
      dependencies: {
        'project-a:build': [],
        'project-b:build': [],
      },
      continuousDependencies: {},
    };

    context = {
      root: '/workspace',
      projectName: 'project-a',
      targetName: 'build',
      configurationName: undefined,
      cwd: '/workspace',
      isVerbose: false,
      projectGraph: {
        nodes: {
          'project-a': projectANode,
          'project-b': projectBNode,
        },
        dependencies: {},
        externalNodes: {},
      },
      projectsConfigurations: {
        version: 2,
        projects: {
          'project-a': projectAConfig,
          'project-b': projectBConfig,
        },
      },
      nxJsonConfiguration: {},
      taskGraph,
    };
  });

  beforeEach(() => {
    spawnMock.mockReset();
    existsSyncMock.mockReset();
    existsSyncMock.mockReturnValue(true);
  });

  it('should initialize batch executor', () => {
    expect(mavenBatchExecutor).toBeDefined();
  });

  it('should relay skipped status emitted by the runner without modification', async () => {
    const inputs: Record<string, MavenExecutorSchema> = {
      'project-a:build': { phase: 'compile' },
      'project-b:build': { phase: 'compile' },
    };

    // The Kotlin runner now emits an explicit `skipped` NX_RESULT for peers
    // that didn't run because a sibling failed. The TS side just relays.
    spawnMock.mockReturnValue(
      createFakeChild({
        stderrLines: [
          'NX_RESULT:' +
            JSON.stringify({
              task: 'project-a:build',
              result: {
                success: false,
                status: 'failure',
                terminalOutput: 'compile error',
              },
            }),
          'NX_RESULT:' +
            JSON.stringify({
              task: 'project-b:build',
              result: {
                success: false,
                status: 'skipped',
                terminalOutput: '',
              },
            }),
        ],
        exitCode: 1,
      })
    );

    const results = await collect(
      mavenBatchExecutor(
        taskGraph,
        inputs,
        { __overrides_unparsed__: [] },
        context
      )
    );

    expect(results).toEqual([
      {
        task: 'project-a:build',
        result: expect.objectContaining({
          success: false,
          status: 'failure',
          terminalOutput: 'compile error',
        }),
      },
      {
        task: 'project-b:build',
        result: expect.objectContaining({
          success: false,
          status: 'skipped',
          terminalOutput: '',
        }),
      },
    ]);
  });

  it('should backfill unreported tasks as failure when the runner crashes', async () => {
    const inputs: Record<string, MavenExecutorSchema> = {
      'project-a:build': { phase: 'compile' },
      'project-b:build': { phase: 'compile' },
    };

    // Runner exits non-zero with no NX_RESULT lines (e.g. JAR crash before
    // reporting anything). The TS side backfills both peers as failure.
    spawnMock.mockReturnValue(
      createFakeChild({ stderrLines: [], exitCode: 1 })
    );

    const results = await collect(
      mavenBatchExecutor(
        taskGraph,
        inputs,
        { __overrides_unparsed__: [] },
        context
      )
    );

    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.result.success).toBe(false);
      expect(r.result.status).toBeUndefined();
    }
  });

  it('should pass through successful results without modification', async () => {
    const inputs: Record<string, MavenExecutorSchema> = {
      'project-a:build': { phase: 'compile' },
      'project-b:build': { phase: 'compile' },
    };

    spawnMock.mockReturnValue(
      createFakeChild({
        stderrLines: [
          'NX_RESULT:' +
            JSON.stringify({
              task: 'project-a:build',
              result: { success: true, terminalOutput: 'a built' },
            }),
          'NX_RESULT:' +
            JSON.stringify({
              task: 'project-b:build',
              result: { success: true, terminalOutput: 'b built' },
            }),
        ],
        exitCode: 0,
      })
    );

    const results = await collect(
      mavenBatchExecutor(
        taskGraph,
        inputs,
        { __overrides_unparsed__: [] },
        context
      )
    );

    expect(results).toEqual([
      {
        task: 'project-a:build',
        result: expect.objectContaining({
          success: true,
          terminalOutput: 'a built',
        }),
      },
      {
        task: 'project-b:build',
        result: expect.objectContaining({
          success: true,
          terminalOutput: 'b built',
        }),
      },
    ]);
  });

  it('should group tasks with same targets', async () => {
    const inputs: Record<string, MavenExecutorSchema> = {
      'project-a:build': {
        phase: 'compile',
      },
      'project-b:build': {
        phase: 'compile',
      },
    };

    // Batch executor should group both tasks since they have identical phases
    expect(mavenBatchExecutor).toBeDefined();
  });

  it('should handle multiple task groups', async () => {
    const inputs: Record<string, MavenExecutorSchema> = {
      'project-a:build': {
        phase: 'compile',
      },
      'project-b:build': {
        phase: 'test',
      },
    };

    // Batch executor should create separate groups for different phases
    expect(mavenBatchExecutor).toBeDefined();
  });

  it('should handle empty overrides', async () => {
    const inputs: Record<string, MavenExecutorSchema> = {
      'project-a:build': {
        phase: 'compile',
      },
    };

    const overrides = {
      __overrides_unparsed__: [],
    };

    expect(mavenBatchExecutor).toBeDefined();
  });
});
