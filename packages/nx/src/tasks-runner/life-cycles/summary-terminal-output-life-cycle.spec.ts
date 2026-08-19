import { stripVTControlCharacters } from 'util';
import { Task } from '../../config/task-graph';
import type { TaskResult } from '../life-cycle';
import { TaskStatus } from '../tasks-runner';
import { SummaryTerminalOutputLifeCycle } from './summary-terminal-output-life-cycle';

jest.mock('../cache', () => ({
  terminalOutputPathForHash: (hash: string) => `/cache/terminalOutputs/${hash}`,
}));

function makeTask(project: string, target = 'test'): Task {
  return {
    id: `${project}:${target}`,
    target: { project, target },
    overrides: { __overrides_unparsed__: [] },
    outputs: [],
    parallelism: true,
    hash: `hash-${project}`,
  } as Partial<Task> as Task;
}

function result(
  task: Task,
  status: TaskStatus,
  terminalOutput = ''
): TaskResult {
  return {
    task,
    status,
    code: status === 'failure' ? 1 : 0,
    terminalOutput,
  } as TaskResult;
}

function captureOutput(cb: () => void): string {
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;
  let captured = '';
  const write = (chunk: any, ...rest: any[]) => {
    captured += chunk;
    rest.find((a) => typeof a === 'function')?.();
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

describe('SummaryTerminalOutputLifeCycle', () => {
  it('prints nothing for a task as it completes', () => {
    const lifeCycle = new SummaryTerminalOutputLifeCycle([makeTask('a')]);

    const out = captureOutput(() => lifeCycle.printTaskTerminalOutput());

    expect(out).toEqual('');
  });

  it('reports counts and no task output when everything passes', () => {
    const a = makeTask('a');
    const b = makeTask('b');
    const lifeCycle = new SummaryTerminalOutputLifeCycle([a, b]);

    const out = captureOutput(() => {
      lifeCycle.endTasks([
        result(a, 'success', 'a body'),
        result(b, 'local-cache', 'b body'),
      ]);
      lifeCycle.endCommand();
    });

    expect(out).toContain('2 tasks: 2 succeeded, 1 cached');
    // A passing run is the case that has to stay small.
    expect(out).not.toContain('a body');
    expect(out).not.toContain('b body');
    expect(out).not.toContain('full log');
    expect(out.split('\n').filter((l) => l.trim()).length).toBeLessThan(6);
  });

  it('prints the failure, its exit code, and the path to its full log', () => {
    const a = makeTask('a');
    const b = makeTask('b');
    const lifeCycle = new SummaryTerminalOutputLifeCycle([a, b]);

    const out = captureOutput(() => {
      lifeCycle.endTasks([
        result(a, 'success', 'a body'),
        result(b, 'failure', 'boom line 1\nboom line 2'),
      ]);
      lifeCycle.endCommand();
    });

    expect(out).toContain('1 succeeded');
    expect(out).toContain('1 failed');
    expect(out).toContain('nx run b:test');
    expect(out).toContain('(exit 1)');
    expect(out).toContain('full log: /cache/terminalOutputs/hash-b');
    // The log is addressed, not reproduced.
    expect(out).not.toContain('boom line 1');
    expect(out).not.toContain('boom line 2');
    // Still nothing about the task that passed.
    expect(out).not.toContain('a body');
  });

  it('stays a fixed size however loud the failure was', () => {
    const a = makeTask('a');
    const lifeCycle = new SummaryTerminalOutputLifeCycle([a]);
    const body = Array.from({ length: 5000 }, (_, i) => `line ${i + 1}`).join(
      '\n'
    );

    const out = captureOutput(() => {
      lifeCycle.endTasks([result(a, 'failure', body)]);
      lifeCycle.endCommand();
    });

    expect(out).not.toContain('line 5000');
    expect(out).toContain('full log: /cache/terminalOutputs/hash-a');
    expect(out.split('\n').filter((l) => l.trim()).length).toBeLessThan(8);
  });

  it('counts tasks that never reported as skipped', () => {
    const a = makeTask('a');
    const b = makeTask('b');
    const c = makeTask('c');
    const lifeCycle = new SummaryTerminalOutputLifeCycle([a, b, c]);

    const out = captureOutput(() => {
      lifeCycle.endTasks([result(a, 'failure', 'boom')]);
      lifeCycle.endCommand();
    });

    // b and c never reached endTasks because a failed first.
    expect(out).toContain('2 skipped');
  });

  it('reports a stopped run as such rather than as a success', () => {
    const a = makeTask('a');
    const lifeCycle = new SummaryTerminalOutputLifeCycle([a]);

    const out = captureOutput(() => {
      lifeCycle.endTasks([result(a, 'stopped', 'partial')]);
      lifeCycle.endCommand();
    });

    expect(out).toContain('1 stopped');
    expect(out).toContain('Stopped before finishing:');
    expect(out).toContain('a:test');
  });

  it('renders the cloud link when one is set', () => {
    const a = makeTask('a');
    const lifeCycle = new SummaryTerminalOutputLifeCycle([a]);

    const out = captureOutput(() => {
      lifeCycle.setCloudLink('View run:', 'https://nx.app/runs/abc');
      lifeCycle.endTasks([result(a, 'success')]);
      lifeCycle.endCommand();
    });

    expect(out).toContain('View run: https://nx.app/runs/abc');
  });

  it('points at the style that inlines logs', () => {
    const a = makeTask('a');
    const lifeCycle = new SummaryTerminalOutputLifeCycle([a]);

    const out = captureOutput(() => {
      lifeCycle.endTasks([result(a, 'failure', 'boom')]);
      lifeCycle.endCommand();
    });

    expect(out).toContain('--output-style=static');
  });
});
