import * as figures from 'figures';
import { stripVTControlCharacters } from 'util';
import { Task } from '../../config/task-graph';
import { withEnvironmentVariables } from '../../internal-testing-utils/with-environment';
import type { TaskResult } from '../life-cycle';
import { TaskStatus } from '../tasks-runner';
import { StaticRunManyTerminalOutputLifeCycle } from './static-run-many-terminal-output-life-cycle';

function makeTask(project: string, target = 'test'): Task {
  return {
    id: `${project}:${target}`,
    target: { project, target },
    overrides: { __overrides_unparsed__: [] },
    outputs: [],
    parallelism: true,
  } as Partial<Task> as Task;
}

function captureOutput(cb: () => void): string {
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;
  let captured = '';
  const write = (chunk: any, ...rest: any[]) => {
    captured += chunk;
    const done = rest.find((arg) => typeof arg === 'function');
    done?.();
    return true;
  };
  process.stdout.write = write as any;
  process.stderr.write = write as any;
  try {
    cb();
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
  }
  return stripVTControlCharacters(captured);
}

function taskResult(task: Task, status: TaskStatus): TaskResult {
  return {
    task,
    status,
    code: status === 'failure' ? 1 : 0,
    terminalOutput: `output of ${task.id}`,
  };
}

/**
 * The statuses that stand in for a task whose output carries no information
 * worth printing in full.
 */
const COLLAPSED_STATUSES: [TaskStatus, string][] = [
  ['success', ''],
  ['local-cache', '[local cache]'],
  ['remote-cache', '[remote cache]'],
  [
    'local-cache-kept-existing',
    '[existing outputs match the cache, left as is]',
  ],
];

describe('StaticRunManyTerminalOutputLifeCycle', () => {
  let lifeCycle: StaticRunManyTerminalOutputLifeCycle;
  let task: Task;

  function createLifeCycle(
    args: { verbose?: boolean } = {},
    tasks: Task[] = [task]
  ) {
    return new StaticRunManyTerminalOutputLifeCycle(
      tasks.map((t) => t.target.project),
      tasks,
      { targets: ['test'], ...args },
      {}
    );
  }

  beforeEach(() => {
    task = makeTask('proj');
    lifeCycle = createLifeCycle();
  });

  describe('printTaskTerminalOutput', () => {
    it('prints the full output for a failed task', () => {
      const result = captureOutput(() =>
        lifeCycle.printTaskTerminalOutput(task, 'failure', 'the failure body')
      );

      expect(result).toContain('> nx run proj:test');
      expect(result).toContain('the failure body');
    });

    it.each(COLLAPSED_STATUSES)(
      'collapses a %s task to a single line',
      (status, suffix) => {
        const result = captureOutput(() =>
          lifeCycle.printTaskTerminalOutput(task, status, 'the task body')
        );

        expect(result).not.toContain('the task body');
        expect(result.trim()).toEqual(
          `${figures.tick}  nx run proj:test${suffix ? `  ${suffix}` : ''}`
        );
      }
    );

    it.each([['skipped'], ['stopped']] as [TaskStatus][])(
      'prints nothing for a %s task',
      (status) => {
        const result = captureOutput(() =>
          lifeCycle.printTaskTerminalOutput(task, status, 'the task body')
        );

        expect(result).toEqual('');
      }
    );

    it.each(COLLAPSED_STATUSES)(
      'prints the full output for a %s task under --verbose',
      (status) => {
        lifeCycle = createLifeCycle({ verbose: true });

        const result = captureOutput(() =>
          lifeCycle.printTaskTerminalOutput(task, status, 'the task body')
        );

        expect(result).toContain('> nx run proj:test');
        expect(result).toContain('the task body');
      }
    );
  });

  describe('log grouping', () => {
    it('wraps a failed task in a collapsible group on GitHub Actions', () => {
      const result = withEnvironmentVariables(
        { GITHUB_ACTIONS: 'true', NX_SKIP_LOG_GROUPING: undefined },
        () =>
          captureOutput(() =>
            lifeCycle.printTaskTerminalOutput(task, 'failure', 'the body')
          )
      );

      expect(result).toContain('::group::❌ > nx run proj:test');
      expect(result).toContain('::endgroup::');
    });

    it.each([
      ['output with a trailing newline', 'the body\n'],
      ['output without a trailing newline', 'the body'],
    ])(
      'terminates the group on its own line for %s',
      (_name, terminalOutput) => {
        const result = withEnvironmentVariables(
          { GITHUB_ACTIONS: 'true', NX_SKIP_LOG_GROUPING: undefined },
          () =>
            captureOutput(() =>
              lifeCycle.printTaskTerminalOutput(task, 'failure', terminalOutput)
            )
        );

        // GitHub only honors a workflow command at the start of a line; glued
        // onto the end of the task's last line it is just text, and the fold
        // never closes.
        const index = result.lastIndexOf('::endgroup::');
        expect(index).toBeGreaterThan(-1);
        expect(result[index - 1]).toEqual('\n');
      }
    );

    it('honors NX_SKIP_LOG_GROUPING', () => {
      const result = withEnvironmentVariables(
        { GITHUB_ACTIONS: 'true', NX_SKIP_LOG_GROUPING: 'true' },
        () =>
          captureOutput(() =>
            lifeCycle.printTaskTerminalOutput(task, 'failure', 'the body')
          )
      );

      expect(result).not.toContain('::group::');
      expect(result).not.toContain('::endgroup::');
    });
  });

  describe('endCommand', () => {
    it('summarizes skipped and stopped tasks as counts', () => {
      const ran = makeTask('ran');
      const stopped = makeTask('stopped');
      const neverRan = makeTask('never-ran');
      lifeCycle = createLifeCycle({}, [ran, stopped, neverRan]);

      lifeCycle.endTasks([
        taskResult(ran, 'success'),
        taskResult(stopped, 'stopped'),
      ]);

      const result = captureOutput(() => lifeCycle.endCommand());

      expect(result).toContain('1 skipped, 1 stopped');
      expect(result).not.toContain('never-ran:test');
      expect(result).not.toContain('stopped:test');
    });

    it('lists the skipped and stopped task names under --verbose', () => {
      const ran = makeTask('ran');
      const stopped = makeTask('stopped');
      const neverRan = makeTask('never-ran');
      lifeCycle = createLifeCycle({ verbose: true }, [ran, stopped, neverRan]);

      lifeCycle.endTasks([
        taskResult(ran, 'success'),
        taskResult(stopped, 'stopped'),
      ]);

      const result = captureOutput(() => lifeCycle.endCommand());

      expect(result).toContain('1 skipped, 1 stopped');
      expect(result).toContain('never-ran:test');
      expect(result).toContain('stopped:test');
    });

    it('does not mention skipped or stopped tasks when there are none', () => {
      lifeCycle.endTasks([taskResult(task, 'success')]);

      const result = captureOutput(() => lifeCycle.endCommand());

      expect(result).not.toContain('skipped');
      expect(result).not.toContain('stopped');
    });

    it('reports stopped tasks alongside failures', () => {
      const failed = makeTask('failed');
      const stopped = makeTask('stopped');
      lifeCycle = createLifeCycle({}, [failed, stopped]);

      lifeCycle.endTasks([
        taskResult(failed, 'failure'),
        taskResult(stopped, 'stopped'),
      ]);

      const result = captureOutput(() => lifeCycle.endCommand());

      expect(result).toContain('Tasks stopped before they finished:');
      expect(result).toContain('stopped:test');
      expect(result).toContain('Failed tasks:');
      expect(result).toContain('failed:test');
    });
  });

  describe('endTasks', () => {
    it('buckets every task status without discarding terminal output', () => {
      const results: TaskResult[] = [
        taskResult(makeTask('a'), 'success'),
        taskResult(makeTask('b'), 'failure'),
        taskResult(makeTask('c'), 'local-cache'),
        taskResult(makeTask('d'), 'remote-cache'),
        taskResult(makeTask('e'), 'local-cache-kept-existing'),
        taskResult(makeTask('f'), 'stopped'),
      ];

      lifeCycle.endTasks(results);

      expect(lifeCycle.failedTasks.map((t) => t.id)).toEqual(['b:test']);
      expect(lifeCycle.cachedTasks.map((t) => t.id)).toEqual([
        'c:test',
        'd:test',
        'e:test',
      ]);
      expect(lifeCycle.stoppedTasks.map((t) => t.id)).toEqual(['f:test']);
      // Nx Cloud reads terminalOutput off of the results it is handed, so
      // filtering what gets printed must never filter what gets reported.
      expect(results.every((r) => !!r.terminalOutput)).toBe(true);
    });
  });
});
