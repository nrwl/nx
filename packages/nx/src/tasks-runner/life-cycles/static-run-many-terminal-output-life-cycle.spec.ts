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
    args: { verbose?: boolean; outputStyle?: string } = {},
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

    it.each(COLLAPSED_STATUSES)(
      'prints the full output for a %s task under --output-style=static-full',
      (status) => {
        lifeCycle = createLifeCycle({ outputStyle: 'static-full' });

        const result = captureOutput(() =>
          lifeCycle.printTaskTerminalOutput(task, status, 'the task body')
        );

        expect(result).toContain('> nx run proj:test');
        expect(result).toContain('the task body');
      }
    );

    it('recovers a stopped task partial output under --verbose', () => {
      // A stopped task was killed mid-flight; what it managed to print is
      // exactly what diagnoses the hang.
      lifeCycle = createLifeCycle({ verbose: true });

      const result = captureOutput(() =>
        lifeCycle.printTaskTerminalOutput(task, 'stopped', 'partial output')
      );

      expect(result).toContain('partial output');
    });
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

    it.each([
      ['on GitHub Actions', 'true'],
      ['outside GitHub Actions', undefined],
    ])(
      'does not glue a following summary line onto a full block %s',
      (_name, githubActions) => {
        const other = makeTask('other');
        const result = withEnvironmentVariables(
          { GITHUB_ACTIONS: githubActions, NX_SKIP_LOG_GROUPING: undefined },
          () =>
            captureOutput(() => {
              // Task output routinely lacks a trailing newline.
              lifeCycle.printTaskTerminalOutput(task, 'failure', 'no newline');
              lifeCycle.printTaskTerminalOutput(other, 'success', 'body');
            })
        );

        const summary = `${figures.tick}  nx run other:test`;
        const index = result.indexOf(summary);
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
    it('summarizes tasks that never ran as a count', () => {
      const ran = makeTask('ran');
      const neverRan = makeTask('never-ran');
      lifeCycle = createLifeCycle({}, [ran, neverRan]);

      lifeCycle.endTasks([taskResult(ran, 'success')]);

      const result = captureOutput(() => lifeCycle.endCommand());

      expect(result).toContain('1 skipped');
      expect(result).not.toContain('never-ran:test');
    });

    it('lists both skipped and stopped tasks by name when the run did not complete', () => {
      const failed = makeTask('failed');
      const stopped = makeTask('stopped');
      const neverRan = makeTask('never-ran');
      lifeCycle = createLifeCycle({}, [failed, stopped, neverRan]);

      lifeCycle.endTasks([
        taskResult(failed, 'failure'),
        taskResult(stopped, 'stopped'),
      ]);

      const result = captureOutput(() => lifeCycle.endCommand());

      expect(result).toContain(
        'Tasks not run because their dependencies failed'
      );
      expect(result).toContain('never-ran:test');
      expect(result).toContain('Tasks stopped before they finished:');
      expect(result).toContain('stopped:test');
      expect(result).toContain('Failed tasks:');
      expect(result).toContain('failed:test');
    });

    it('does not claim success when a task was stopped', () => {
      const ran = makeTask('ran');
      const stopped = makeTask('stopped');
      lifeCycle = createLifeCycle({}, [ran, stopped]);

      lifeCycle.endTasks([
        taskResult(ran, 'success'),
        taskResult(stopped, 'stopped'),
      ]);

      const result = captureOutput(() => lifeCycle.endCommand());

      expect(result).not.toContain('Successfully ran');
      expect(result).toContain('did not complete');
      expect(result).toContain('Tasks stopped before they finished:');
      // Nothing outright failed, so there is no failure list to print.
      expect(result).not.toContain('Failed tasks:');
    });

    it('lists the names of tasks that never ran under --verbose', () => {
      const ran = makeTask('ran');
      const neverRan = makeTask('never-ran');
      lifeCycle = createLifeCycle({ verbose: true }, [ran, neverRan]);

      lifeCycle.endTasks([taskResult(ran, 'success')]);

      const result = captureOutput(() => lifeCycle.endCommand());

      expect(result).toContain('1 skipped');
      expect(result).toContain('never-ran:test');
    });

    it('says how much output was withheld', () => {
      lifeCycle.printTaskTerminalOutput(task, 'success', 'the task body');
      lifeCycle.endTasks([taskResult(task, 'success')]);

      const result = captureOutput(() => lifeCycle.endCommand());

      expect(result).toContain('Output of 1 successful task was not shown');
      expect(result).toContain('--verbose');
    });

    it('does not offer the hint when nothing was withheld', () => {
      lifeCycle = createLifeCycle({ verbose: true });
      lifeCycle.printTaskTerminalOutput(task, 'success', 'the task body');
      lifeCycle.endTasks([taskResult(task, 'success')]);

      const result = captureOutput(() => lifeCycle.endCommand());

      expect(result).not.toContain('was not shown');
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
    });
  });
});
