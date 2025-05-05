import { getTuiTerminalSummaryLifeCycle } from './tui-summary-life-cycle';
import { Task } from '../../config/task-graph';
import { stripVTControlCharacters } from 'util';
import { EOL } from 'os';

let originalHrTime;
let originalColumns;

describe('getTuiTerminalSummaryLifeCycle', () => {
  beforeAll(() => {
    originalHrTime = process.hrtime;
    originalColumns = process.stdout.columns;
    process.stdout.columns = 80;
    process.hrtime = ((x) => {
      if (x !== undefined) {
        return [x[0] + 1, x[1]];
      }
      return [22229415, 668399708];
    }) as any;
  });

  afterAll(() => {
    process.hrtime = originalHrTime;
    process.stdout.columns = originalColumns;
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
        initiatingProject: 'test',
        initiatingTasks: [],
        overrides: {},
        projectNames: ['test'],
        tasks: [target, dep],
        resolveRenderIsDonePromise: jest.fn().mockResolvedValue(null),
      });

      lifeCycle.startTasks([dep], null);
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
        initiatingProject: 'test',
        initiatingTasks: [],
        overrides: {},
        projectNames: ['test'],
        tasks: [target, dep],
        resolveRenderIsDonePromise: jest.fn().mockResolvedValue(null),
      });

      lifeCycle.startTasks([dep], null);
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
      lifeCycle.endCommand();

      const lines = getOutputLines(printSummary);

      expect(lines.join('\n')).toMatchInlineSnapshot(`
        "
        > nx run test:pre-test

        :)
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
        overrides: {},
        projectNames: ['test'],
        tasks: [target, dep],
        resolveRenderIsDonePromise: jest.fn().mockResolvedValue(null),
      });

      lifeCycle.startTasks([dep], null);
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
        overrides: {},
        projectNames: ['foo', 'bar'],
        tasks: [foo, bar],
        resolveRenderIsDonePromise: jest.fn().mockResolvedValue(null),
      });

      lifeCycle.startTasks([bar, foo], null);
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
        overrides: {},
        projectNames: ['foo', 'bar'],
        tasks: [foo, bar],
        resolveRenderIsDonePromise: jest.fn().mockResolvedValue(null),
      });

      lifeCycle.startTasks([bar, foo], null);
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
        projectNames: ['foo', 'bar'],
        tasks: [foo, bar],
        resolveRenderIsDonePromise: jest.fn().mockResolvedValue(null),
      });

      lifeCycle.startTasks([bar, foo], null);
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
