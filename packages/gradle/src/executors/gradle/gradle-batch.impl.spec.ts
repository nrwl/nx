import gradleBatch, { getGradlewTasksToRun } from './gradle-batch.impl';
import {
  ExecutorContext,
  TaskGraph,
  ProjectGraphProjectNode,
} from '@nx/devkit';
import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { GradleExecutorSchema } from './schema';

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  spawn: jest.fn(),
}));
jest.mock('../../utils/exec-gradle', () => ({
  findGradlewFile: jest.fn(() => 'gradlew'),
  getCustomGradleExecutableDirectoryFromPlugin: jest.fn(() => undefined),
}));

const spawnMock = spawn as jest.MockedFunction<typeof spawn>;

interface FakeChildOptions {
  stdoutLines: string[];
  exitCode: number;
}

function createFakeChild({
  stdoutLines,
  exitCode,
}: FakeChildOptions): ChildProcess {
  const stdout = new Readable({ read() {} });
  for (const line of stdoutLines) {
    stdout.push(line.endsWith('\n') ? line : `${line}\n`);
  }
  stdout.push(null);

  const child = new EventEmitter() as ChildProcess;
  Object.assign(child, { stdout, stderr: null, stdin: null });
  setImmediate(() => child.emit('close', exitCode));
  return child;
}

async function collect<T>(iter: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iter) out.push(item);
  return out;
}

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
              dependsOn: [
                { target: 'lint' },
                { target: 'build', projects: ['app2'] },
              ],
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
              dependsOn: [{ target: 'test', projects: ['app1'] }],
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
        'app1:lint': {
          id: 'app1:lint',
          target: { project: 'app1', target: 'lint' },
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
      dependencies: {
        'app1:test': ['app1:lint', 'app2:build'],
        'app1:lint': [],
        'app2:build': [],
      },
      continuousDependencies: {},
      roots: ['app1:lint', 'app2:build'],
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

    expect(result.excludeTasks).toEqual(new Set());
    expect(result.excludeTestTasks).toEqual(new Set());
  });

  it('should resolve transitive deps via fullTaskGraph when batch graph omits them', () => {
    const batchTaskGraph: TaskGraph = {
      tasks: {
        'app1:test': taskGraph.tasks['app1:test'],
      },
      dependencies: {
        'app1:test': [],
      },
      continuousDependencies: {},
      roots: ['app1:test'],
    };

    const taskIds = ['app1:test'];
    const result = getGradlewTasksToRun(
      taskIds,
      batchTaskGraph,
      inputs,
      nodes,
      taskGraph
    );

    expect(result.excludeTasks).toEqual(new Set(['lintApp1', 'buildApp2']));
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
    taskGraph.dependencies['app3:deploy'] = ['app1:test'];
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

  describe('gradleBatch (async generator)', () => {
    let context: ExecutorContext;
    let batchTaskGraph: TaskGraph;
    let batchInputs: Record<string, GradleExecutorSchema>;

    beforeEach(() => {
      spawnMock.mockReset();
      batchTaskGraph = {
        tasks: {
          'app2:build': taskGraph.tasks['app2:build'],
          'app1:test': taskGraph.tasks['app1:test'],
        },
        dependencies: {
          'app2:build': [],
          'app1:test': ['app2:build'],
        },
        continuousDependencies: {},
        roots: ['app2:build'],
      };
      batchInputs = {
        'app2:build': { taskName: 'build', excludeDependsOn: false },
        'app1:test': { taskName: 'test', excludeDependsOn: false },
      };
      context = {
        root: '/workspace',
        cwd: '/workspace',
        isVerbose: false,
        projectGraph: { nodes, dependencies: {}, externalNodes: {} },
        projectsConfigurations: {
          version: 2,
          projects: {
            app1: nodes.app1.data,
            app2: nodes.app2.data,
            app3: nodes.app3.data,
          },
        },
        nxJsonConfiguration: {},
        taskGraph: batchTaskGraph,
      } as unknown as ExecutorContext;
    });

    it('relays skipped status emitted by the runner without modification', async () => {
      // The Kotlin runner now emits an explicit `skipped` NX_RESULT for peers
      // that didn't run because a sibling failed. The TS side just relays.
      spawnMock.mockReturnValue(
        createFakeChild({
          stdoutLines: [
            'NX_RESULT:' +
              JSON.stringify({
                task: 'app2:build',
                result: {
                  success: false,
                  status: 'failure',
                  terminalOutput: 'compile error',
                },
              }),
            'NX_RESULT:' +
              JSON.stringify({
                task: 'app1:test',
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
        gradleBatch(
          batchTaskGraph,
          batchInputs,
          { __overrides_unparsed__: [] } as any,
          context
        )
      );

      const byTask = Object.fromEntries(results.map((r) => [r.task, r.result]));
      expect(byTask['app2:build']).toEqual(
        expect.objectContaining({
          success: false,
          status: 'failure',
          terminalOutput: 'compile error',
        })
      );
      expect(byTask['app1:test']).toEqual(
        expect.objectContaining({
          success: false,
          status: 'skipped',
          terminalOutput: '',
        })
      );
    });

    it('backfills unreported tasks as failure when the runner crashes', async () => {
      // Runner exits non-zero with no NX_RESULT lines — TS side backfills as
      // failure so Nx doesn't hang waiting for the missing task.
      spawnMock.mockReturnValue(
        createFakeChild({ stdoutLines: [], exitCode: 1 })
      );

      const results = await collect(
        gradleBatch(
          batchTaskGraph,
          batchInputs,
          { __overrides_unparsed__: [] } as any,
          context
        )
      );

      expect(results).toHaveLength(2);
      for (const r of results) {
        expect(r.result.success).toBe(false);
        expect(r.result.status).toBeUndefined();
      }
    });

    it('passes through successful results without modification', async () => {
      spawnMock.mockReturnValue(
        createFakeChild({
          stdoutLines: [
            'NX_RESULT:' +
              JSON.stringify({
                task: 'app2:build',
                result: { success: true, terminalOutput: 'a built' },
              }),
            'NX_RESULT:' +
              JSON.stringify({
                task: 'app1:test',
                result: { success: true, terminalOutput: 'b tested' },
              }),
          ],
          exitCode: 0,
        })
      );

      const results = await collect(
        gradleBatch(
          batchTaskGraph,
          batchInputs,
          { __overrides_unparsed__: [] } as any,
          context
        )
      );

      expect(results).toEqual([
        {
          task: 'app2:build',
          result: expect.objectContaining({
            success: true,
            terminalOutput: 'a built',
          }),
        },
        {
          task: 'app1:test',
          result: expect.objectContaining({
            success: true,
            terminalOutput: 'b tested',
          }),
        },
      ]);
    });
  });

  it('does not exclude transitive deps shared with an excludeDependsOn:false task', () => {
    nodes['lib1'] = {
      name: 'lib1',
      type: 'lib',
      data: {
        root: 'lib1',
        targets: {
          jar: { options: { taskName: 'jarLib1' } },
        },
      },
    };
    taskGraph.tasks['lib1:jar'] = {
      id: 'lib1:jar',
      target: { project: 'lib1', target: 'jar' },
      outputs: [],
      overrides: {},
      projectRoot: 'lib1',
      parallelism: false,
    };
    taskGraph.dependencies['lib1:jar'] = [];
    taskGraph.dependencies['app1:test'] = ['app1:lint', 'lib1:jar'];
    taskGraph.dependencies['app2:build'] = ['lib1:jar'];

    const taskIds = ['app1:test', 'app2:build'];
    const result = getGradlewTasksToRun(taskIds, taskGraph, inputs, nodes);

    // app1:test has excludeDependsOn:true → would exclude its deps (app1:lint, lib1:jar).
    // app2:build has excludeDependsOn:false → its deps must run, including lib1:jar.
    // Because lib1:jar is required by app2:build, it must NOT appear in excludeTasks
    // even though app1:test's exclude pass would otherwise drop it.
    expect(result.excludeTasks).toEqual(new Set(['lintApp1']));
    expect(result.excludeTasks.has('jarLib1')).toBe(false);
    expect(result.excludeTestTasks).toEqual(new Set());
  });
});
