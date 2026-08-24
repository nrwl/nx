import * as figures from 'figures';
import { stripVTControlCharacters } from 'util';
import { Task } from '../../config/task-graph';
import type { TaskResult } from '../life-cycle';
import { TaskStatus } from '../tasks-runner';
import { StaticRunOneTerminalOutputLifeCycle } from './static-run-one-terminal-output-life-cycle';

function makeTask(project: string, target = 'build'): Task {
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

const COLLAPSED_STATUSES: [TaskStatus, string][] = [
  ['success', ''],
  ['local-cache', '[local cache]'],
  ['remote-cache', '[remote cache]'],
  [
    'local-cache-kept-existing',
    '[existing outputs match the cache, left as is]',
  ],
];

describe('StaticRunOneTerminalOutputLifeCycle', () => {
  /** The task the user actually asked for. */
  let initiating: Task;
  /** A task that only ran because the initiating task depends on it. */
  let dependency: Task;

  function createLifeCycle(
    args: { verbose?: boolean; outputStyle?: string } = {},
    tasks: Task[] = [initiating, dependency]
  ) {
    return new StaticRunOneTerminalOutputLifeCycle(
      'app',
      tasks.map((t) => t.target.project),
      tasks,
      { targets: ['build'], ...args }
    );
  }

  beforeEach(() => {
    initiating = makeTask('app');
    dependency = makeTask('lib');
  });

  describe('printTaskTerminalOutput', () => {
    it.each(COLLAPSED_STATUSES)(
      'always prints the full output of the initiating task, even on %s',
      (status) => {
        const lifeCycle = createLifeCycle();

        const result = captureOutput(() =>
          lifeCycle.printTaskTerminalOutput(initiating, status, 'the app body')
        );

        expect(result).toContain('> nx run app:build');
        expect(result).toContain('the app body');
      }
    );

    it.each(COLLAPSED_STATUSES)(
      'collapses a dependency task to a single line on %s',
      (status, suffix) => {
        const lifeCycle = createLifeCycle();

        const result = captureOutput(() =>
          lifeCycle.printTaskTerminalOutput(dependency, status, 'the lib body')
        );

        expect(result).not.toContain('the lib body');
        expect(result.trim()).toEqual(
          `${figures.tick}  nx run lib:build${suffix ? `  ${suffix}` : ''}`
        );
      }
    );

    it('prints the full output of a failed dependency task', () => {
      const lifeCycle = createLifeCycle();

      const result = captureOutput(() =>
        lifeCycle.printTaskTerminalOutput(dependency, 'failure', 'the lib body')
      );

      expect(result).toContain('> nx run lib:build');
      expect(result).toContain('the lib body');
    });

    it.each([['skipped'], ['stopped']] as [TaskStatus][])(
      'prints nothing for a %s task',
      (status) => {
        const lifeCycle = createLifeCycle();

        const result = captureOutput(() =>
          lifeCycle.printTaskTerminalOutput(dependency, status, 'the lib body')
        );

        expect(result).toEqual('');
      }
    );

    it.each(COLLAPSED_STATUSES)(
      'prints the full output of a dependency task on %s under --output-style=static',
      (status) => {
        const lifeCycle = createLifeCycle({ outputStyle: 'static' });

        const result = captureOutput(() =>
          lifeCycle.printTaskTerminalOutput(dependency, status, 'the lib body')
        );

        expect(result).toContain('> nx run lib:build');
        expect(result).toContain('the lib body');
      }
    );

    it.each(COLLAPSED_STATUSES)(
      'collapses a dependency task on %s under --output-style=static-failures-only',
      (status) => {
        // The literal the default resolves to; pinned so a refactor of
        // printsFullOutput cannot invert it with every other test still green.
        const lifeCycle = createLifeCycle({
          outputStyle: 'static-failures-only',
        });

        const result = captureOutput(() =>
          lifeCycle.printTaskTerminalOutput(dependency, status, 'the lib body')
        );

        expect(result).not.toContain('the lib body');
        expect(result).toContain('nx run lib:build');
      }
    );

    it.each(COLLAPSED_STATUSES)(
      'prints the full output of a dependency task on %s under --verbose',
      (status) => {
        const lifeCycle = createLifeCycle({ verbose: true });

        const result = captureOutput(() =>
          lifeCycle.printTaskTerminalOutput(dependency, status, 'the lib body')
        );

        expect(result).toContain('> nx run lib:build');
        expect(result).toContain('the lib body');
      }
    );
  });

  describe('endCommand', () => {
    it('summarizes tasks that never ran as a count on success', () => {
      const neverRan = makeTask('never-ran');
      const lifeCycle = createLifeCycle({}, [initiating, neverRan]);

      lifeCycle.endTasks([taskResult(initiating, 'success')]);

      const result = captureOutput(() => lifeCycle.endCommand());

      expect(result).toContain('Successfully ran');
      expect(result).toContain('1 skipped');
      expect(result).not.toContain('never-ran:build');
    });

    it('does not claim success when a task was stopped', () => {
      const stopped = makeTask('stopped');
      const lifeCycle = createLifeCycle({}, [initiating, stopped]);

      lifeCycle.endTasks([
        taskResult(initiating, 'success'),
        taskResult(stopped, 'stopped'),
      ]);

      const result = captureOutput(() => lifeCycle.endCommand());

      expect(result).not.toContain('Successfully ran');
      expect(result).toContain('did not complete');
      expect(result).toContain('Tasks stopped before they finished:');
      expect(result).toContain('stopped:build');
      // Nothing outright failed, so there is no failure list to print.
      expect(result).not.toContain('Failed tasks:');
    });

    it('lists the names of tasks that never ran under --verbose', () => {
      const neverRan = makeTask('never-ran');
      const lifeCycle = createLifeCycle({ verbose: true }, [
        initiating,
        neverRan,
      ]);

      lifeCycle.endTasks([taskResult(initiating, 'success')]);

      const result = captureOutput(() => lifeCycle.endCommand());

      expect(result).toContain('1 skipped');
      expect(result).toContain('never-ran:build');
    });

    it('reports how much output was withheld on success', () => {
      const dependency = makeTask('lib');
      const lifeCycle = createLifeCycle({}, [initiating, dependency]);

      // A collapsed dependency success. Wrapped so it does not write into
      // jest's own output or leave the shared CLIOutput mid-line.
      captureOutput(() =>
        lifeCycle.printTaskTerminalOutput(dependency, 'success', 'the lib body')
      );
      lifeCycle.endTasks([
        taskResult(initiating, 'success'),
        taskResult(dependency, 'success'),
      ]);

      const result = captureOutput(() => lifeCycle.endCommand());

      expect(result).toContain('Output of 1 successful task was not shown');
      expect(result).toContain('--verbose');
    });

    it('lists tasks that never ran when the run failed', () => {
      const neverRan = makeTask('never-ran');
      const lifeCycle = createLifeCycle({}, [initiating, neverRan]);

      lifeCycle.endTasks([taskResult(initiating, 'failure')]);

      const result = captureOutput(() => lifeCycle.endCommand());

      expect(result).toContain(
        'Tasks not run because their dependencies failed'
      );
      expect(result).toContain('never-ran:build');
    });

    it('reports stopped tasks alongside failures', () => {
      const stopped = makeTask('stopped');
      const lifeCycle = createLifeCycle({}, [initiating, stopped]);

      lifeCycle.endTasks([
        taskResult(initiating, 'failure'),
        taskResult(stopped, 'stopped'),
      ]);

      const result = captureOutput(() => lifeCycle.endCommand());

      expect(result).toContain('Tasks stopped before they finished:');
      expect(result).toContain('stopped:build');
      expect(result).toContain('Failed tasks:');
      expect(result).toContain('app:build');
    });
  });
});
