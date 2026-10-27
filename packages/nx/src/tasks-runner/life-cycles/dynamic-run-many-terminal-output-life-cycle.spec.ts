import { stripVTControlCharacters } from 'util';
import { Task } from '../../config/task-graph';
import type { TaskMetadata } from '../life-cycle';
import { createRunManyDynamicOutputRenderer } from './dynamic-run-many-terminal-output-life-cycle';

function makeTask(project: string): Task {
  return {
    id: `${project}:check`,
    target: { project, target: 'check' },
    overrides: {},
    outputs: [],
  } as Partial<Task> as Task;
}

async function captureOutput(cb: () => Promise<void>): Promise<string> {
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
    await cb();
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
  }
  return stripVTControlCharacters(captured);
}

describe('createRunManyDynamicOutputRenderer', () => {
  let processOn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    processOn = vi.spyOn(process, 'on').mockImplementation(() => process);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['skipped', false, ['⏭  2/3 targets were skipped.']],
    [
      'stopped or not started after a signal',
      true,
      [
        '…  1/3 targets were in progress, including the following:',
        '- nx run b:check',
        '…  1/3 targets had not started.',
      ],
    ],
  ])(
    'counts against the total and reports tasks that never finished as %s',
    async (_, signalled, notRunLines) => {
      const a = makeTask('a');
      const b = makeTask('b');
      const c = makeTask('c');

      const out = await captureOutput(async () => {
        const { lifeCycle, renderIsDone } =
          await createRunManyDynamicOutputRenderer({
            projectNames: ['a', 'b', 'c'],
            tasks: [a, b, c],
            args: { targets: ['check'] },
            overrides: {},
          });
        lifeCycle.startTasks([a], {} as TaskMetadata);
        lifeCycle.endTasks(
          [{ task: a, status: 'failure', code: 1 }],
          {} as TaskMetadata
        );
        if (signalled) {
          lifeCycle.startTasks([b], {} as TaskMetadata);
          const [, onSigterm] = processOn.mock.calls.find(
            ([event]) => event === 'SIGTERM'
          );
          onSigterm();
          lifeCycle.endTasks(
            [{ task: b, status: 'stopped', code: 143 }],
            {} as TaskMetadata
          );
        }
        lifeCycle.endCommand();
        await renderIsDone;
      });

      expect(out).toContain('✖  1/3 targets failed, including the following:');
      for (const line of notRunLines) {
        expect(out).toContain(line);
      }
      // A count of 0 has nothing to report.
      expect(out).not.toContain('succeeded');
    }
  );
});
