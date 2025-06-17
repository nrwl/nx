import { stripVTControlCharacters } from 'util';
import { EOL } from 'os';

import { getTuiTerminalSummaryLifeCycle } from './tui-summary-life-cycle';
import { Task } from '../../config/task-graph';
import { TaskStatus as NativeTaskStatus } from '../../native';

let originalHrTime;
let originalColumns;
let originalDbEnabled;

describe('getTuiTerminalSummaryLifeCycle', () => {
  beforeAll(() => {
    originalHrTime = process.hrtime;
    originalColumns = process.stdout.columns;
    originalDbEnabled = process.env.NX_DISABLE_DB;
    process.stdout.columns = 80;
    process.hrtime = ((x) => {
      if (x !== undefined) {
        return [x[0] + 1, x[1]];
      }
      return [22229415, 668399708];
    }) as any;
    // Disable DB to avoid issues when running tests
    process.env.NX_DISABLE_DB = 'true';
  });

  afterAll(() => {
    process.hrtime = originalHrTime;
    process.stdout.columns = originalColumns;
    process.env.NX_DISABLE_DB = originalDbEnabled;
  });

  beforeEach(() => {});

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('runOne', () => {
    it('should handle failed run-one tasks', async () => {
      const target = {
        id: 'test:test',
      } as Partial<Task> as Task;
      const dep = {
        id: 'test:pre-test',
      } as Partial<Task> as Task;

      const { lifeCycle, printSummary } = getTuiTerminalSummaryLifeCycle({
        args: {
          targets: ['test'],
        },
        taskGraph: {
          tasks: { dep },
          dependencies: {},
          continuousDependencies: {},
          continueOnFailureDependencies: {},
          roots: [],
        },
        initiatingProject: 'test',
        initiatingTasks: [],
        overrides: {},
        projectNames: ['test'],
        tasks: [target, dep],
        resolveRenderIsDonePromise: jest.fn().mockResolvedValue(null),
      });

      lifeCycle.startTasks([dep], null);
      lifeCycle.appendTaskOutput(dep.id, 'boom', true);
      lifeCycle.endTasks(
        [
          {
            code: 1,
            status: 'failure',
            task: dep,
            terminalOutput: 'boom',
          },
        ],
        null
      );
      lifeCycle.printTaskTerminalOutput(dep, 'failure', 'boom');
      lifeCycle.endCommand();

      const lines = getOutputLines(printSummary);

      expect(lines.join('\n')).toMatchInlineSnapshot(`
        "
        > nx run test:pre-test

        boom
        ———————————————————————————————————————————————————————————————————————————————

         NX   Ran target test for project test and 1 task(s) they depend on (37w)

           ✖  1/1 failed
           ✔  0/1 succeeded [0 read from cache]
        "
      `);
    });

    it('should handle canceled run-one tasks', async () => {
      const target = {
        id: 'test:test',
      } as Partial<Task> as Task;
      const dep = {
        id: 'test:pre-test',
      } as Partial<Task> as Task;

      const { lifeCycle, printSummary } = getTuiTerminalSummaryLifeCycle({
        args: {
          targets: ['test'],
        },
        taskGraph: {
          tasks: { dep, target },
          dependencies: {},
          continuousDependencies: {},
          continueOnFailureDependencies: {},
          roots: [],
        },
        initiatingProject: 'test',
        initiatingTasks: [],
        overrides: {},
        projectNames: ['test'],
        tasks: [target, dep],
        resolveRenderIsDonePromise: jest.fn().mockResolvedValue(null),
      });

      lifeCycle.startTasks([dep], null);
      lifeCycle.appendTaskOutput(dep.id, ':)', true);
      lifeCycle.endTasks(
        [
          {
            code: 1,
            status: 'success',
            task: dep,
            terminalOutput: ':)',
          },
        ],
        null
      );
      lifeCycle.printTaskTerminalOutput(dep, 'success', ':)');
      lifeCycle.startTasks([target], null);
      lifeCycle.appendTaskOutput(target.id, "Wait, I'm not done yet", true);
      lifeCycle.endCommand();

      const lines = getOutputLines(printSummary);

      expect(lines.join('\n')).toMatchInlineSnapshot(`
        "
        > nx run test:pre-test

        :)
        > nx run test:test

        Wait, I'm not done yet
        ———————————————————————————————————————————————————————————————————————————————

         NX   Cancelled running target test for project test (37w)
        "
      `);
    });

    it('should handle successful run-one tasks', async () => {
      const target = {
        id: 'test:test',
      } as Partial<Task> as Task;
      const dep = {
        id: 'test:pre-test',
      } as Partial<Task> as Task;

      const { lifeCycle, printSummary } = getTuiTerminalSummaryLifeCycle({
        args: {
          targets: ['test'],
        },
        initiatingProject: 'test',
        initiatingTasks: [],
        taskGraph: {
          tasks: { dep, target },
          dependencies: {},
          continuousDependencies: {},
          continueOnFailureDependencies: {},
          roots: [],
        },
        overrides: {},
        projectNames: ['test'],
        tasks: [target, dep],
        resolveRenderIsDonePromise: jest.fn().mockResolvedValue(null),
      });

      lifeCycle.startTasks([dep], null);
      lifeCycle.appendTaskOutput(dep.id, ':)', true);
      lifeCycle.endTasks(
        [
          {
            code: 0,
            status: 'success',
            task: dep,
            terminalOutput: ':)',
          },
        ],
        null
      );
      lifeCycle.printTaskTerminalOutput(dep, 'success', ':)');
      lifeCycle.endCommand();

      const lines = getOutputLines(printSummary);

      expect(lines.join('\n')).toMatchInlineSnapshot(`
        "
        > nx run test:pre-test

        :)
        ———————————————————————————————————————————————————————————————————————————————

         NX   Ran target test for project test and 1 task(s) they depend on (37w)

           ✖  0/1 failed
           ✔  1/1 succeeded [0 read from cache]
        "
      `);
    });

    it('should display cancelled for single continuous task', async () => {
      const target = {
        id: 'test:dev',
        continuous: true,
        target: {
          target: 'dev',
          project: 'test',
        },
      } as Partial<Task> as Task;

      const { lifeCycle, printSummary } = getTuiTerminalSummaryLifeCycle({
        args: {
          targets: ['dev'],
        },
        initiatingProject: 'test',
        initiatingTasks: [],
        taskGraph: {
          tasks: { [target.id]: target },
          dependencies: {
            [target.id]: [],
          },
          continuousDependencies: {},
          continueOnFailureDependencies: {},
          roots: [],
        },
        overrides: {},
        projectNames: ['test'],
        tasks: [target],
        resolveRenderIsDonePromise: jest.fn().mockResolvedValue(null),
      });

      lifeCycle.startTasks([target], null);
      lifeCycle.appendTaskOutput(target.id, 'I was a happy dev server', true);
      lifeCycle.setTaskStatus(target.id, NativeTaskStatus.Stopped);
      lifeCycle.printTaskTerminalOutput(
        target,
        'success',
        'I was a happy dev server'
      );
      lifeCycle.endCommand();
      // Continuous tasks are marked as stopped when the command is stopped

      const lines = getOutputLines(printSummary);

      expect(lines.join('\n')).toMatchInlineSnapshot(`
        "
        > nx run test:dev

        I was a happy dev server
        ———————————————————————————————————————————————————————————————————————————————

         NX   Cancelled running target dev for project test (37w)
        "
      `);
    });
  });

  describe('runMany', () => {
    it('should handle failed run-many tasks', async () => {
      const foo = {
        id: 'foo:test',
        target: {
          target: 'test',
          project: 'foo',
        },
      } as Partial<Task> as Task;
      const bar = {
        id: 'bar:test',
        target: {
          target: 'test',
          project: 'bar',
        },
      } as Partial<Task> as Task;

      const { lifeCycle, printSummary } = getTuiTerminalSummaryLifeCycle({
        args: {
          targets: ['test'],
        },
        initiatingProject: null,
        initiatingTasks: [],
        taskGraph: {
          tasks: { foo, bar },
          dependencies: {},
          continuousDependencies: {},
          continueOnFailureDependencies: {},
          roots: [],
        },
        overrides: {},
        projectNames: ['foo', 'bar'],
        tasks: [foo, bar],
        resolveRenderIsDonePromise: jest.fn().mockResolvedValue(null),
      });

      lifeCycle.startTasks([foo, bar], null);
      lifeCycle.appendTaskOutput(foo.id, ':)', true);
      lifeCycle.appendTaskOutput(bar.id, 'boom', true);
      lifeCycle.endTasks(
        [
          {
            code: 1,
            status: 'failure',
            task: bar,
            terminalOutput: 'boom',
          },
          {
            code: 0,
            status: 'success',
            task: foo,
            terminalOutput: 'foo',
          },
        ],
        null
      );
      lifeCycle.printTaskTerminalOutput(foo, 'success', ':)');
      lifeCycle.printTaskTerminalOutput(bar, 'failure', 'boom');
      lifeCycle.endCommand();

      const lines = getOutputLines(printSummary);

      expect(lines.join('\n')).toMatchInlineSnapshot(`
        "

        > nx run bar:test

        boom

           ✔  nx run foo:test
           ✖  nx run bar:test

        ———————————————————————————————————————————————————————————————————————————————

         NX   Ran target test for 2 projects (37w)

           ✔  1/2 succeeded [0 read from cache]

           ✖  1/2 targets failed, including the following:

              - nx run bar:test

        "
      `);
    });

    it('should handle canceled run-many tasks', async () => {
      const foo = {
        id: 'foo:test',
        target: {
          target: 'test',
          project: 'foo',
        },
      } as Partial<Task> as Task;
      const bar = {
        id: 'bar:test',
        target: {
          target: 'test',
          project: 'bar',
        },
      } as Partial<Task> as Task;

      const { lifeCycle, printSummary } = getTuiTerminalSummaryLifeCycle({
        args: {
          targets: ['test'],
        },
        initiatingProject: null,
        initiatingTasks: [],
        taskGraph: {
          tasks: { foo, bar },
          dependencies: {},
          continuousDependencies: {},
          continueOnFailureDependencies: {},
          roots: [],
        },
        overrides: {},
        projectNames: ['foo', 'bar'],
        tasks: [foo, bar],
        resolveRenderIsDonePromise: jest.fn().mockResolvedValue(null),
      });

      lifeCycle.startTasks([bar, foo], null);
      lifeCycle.appendTaskOutput(foo.id, 'Stop, in the name of', true);
      lifeCycle.appendTaskOutput(bar.id, 'Love', true);
      lifeCycle.endTasks(
        [
          {
            code: 0,
            status: 'success',
            task: foo,
            terminalOutput: 'foo',
          },
        ],
        null
      );
      lifeCycle.printTaskTerminalOutput(foo, 'success', ':)');
      lifeCycle.endCommand();

      const lines = getOutputLines(printSummary);
      expect(lines.join('\n')).toMatchInlineSnapshot(`
        "

        > nx run bar:test

        Love

           ◼  nx run bar:test
           ✔  nx run foo:test

        ———————————————————————————————————————————————————————————————————————————————

         NX   Cancelled while running target test for 2 projects (37w)

           ✔  1/1 succeeded [0 read from cache]

           …  1/2 targets were in progress, including the following:

              - nx run bar:test

        "
      `);
    });

    it('should handle successful run-many tasks', async () => {
      const foo = {
        id: 'foo:test',
        target: {
          target: 'test',
          project: 'foo',
        },
      } as Partial<Task> as Task;
      const bar = {
        id: 'bar:test',
        target: {
          target: 'test',
          project: 'bar',
        },
      } as Partial<Task> as Task;

      const { lifeCycle, printSummary } = getTuiTerminalSummaryLifeCycle({
        args: {
          targets: ['test'],
        },
        initiatingProject: null,
        initiatingTasks: [],
        overrides: {},
        taskGraph: {
          tasks: { foo, bar },
          dependencies: {},
          continuousDependencies: {},
          continueOnFailureDependencies: {},
          roots: [],
        },
        projectNames: ['foo', 'bar'],
        tasks: [foo, bar],
        resolveRenderIsDonePromise: jest.fn().mockResolvedValue(null),
      });

      lifeCycle.startTasks([foo, bar], null);
      lifeCycle.appendTaskOutput(foo.id, ':)', true);
      lifeCycle.appendTaskOutput(bar.id, ':)', true);
      lifeCycle.endTasks(
        [
          {
            code: 0,
            status: 'success',
            task: bar,
            terminalOutput: ':)',
          },
          {
            code: 0,
            status: 'success',
            task: foo,
            terminalOutput: ':)',
          },
        ],
        null
      );
      lifeCycle.printTaskTerminalOutput(foo, 'success', ':)');
      lifeCycle.printTaskTerminalOutput(bar, 'success', ':)');
      lifeCycle.endCommand();

      const lines = getOutputLines(printSummary);

      expect(lines.join('\n')).toMatchInlineSnapshot(`
        "

           ✔  nx run foo:test
           ✔  nx run bar:test

        ———————————————————————————————————————————————————————————————————————————————

         NX   Successfully ran target test for 2 projects (37w)
        "
      `);
    });
  });
});

function getOutputLines(cb: () => void) {
  const lines = [];
  const originalLog = console.log;
  const originalStdout = process.stdout.write;
  let buf = '';
  console.log = (...args) => {
    lines.push(buf + stripVTControlCharacters(args.join(' ')));
    buf = '';
  };
  process.stdout.write = (chunk, callback) => {
    buf += chunk;
    if (buf.includes('boom')) {
    }
    if (buf.includes(EOL)) {
      const l = buf.split(EOL);
      if (l[l.length - 1] === '') {
        l.pop();
      }
      for (const line of l) {
        lines.push(stripVTControlCharacters(line));
      }
      buf = '';
    }
    if (callback) {
      callback();
    }
    return true;
  };
  cb();
  console.log = originalLog;
  process.stdout.write = originalStdout;
  return lines;
}
