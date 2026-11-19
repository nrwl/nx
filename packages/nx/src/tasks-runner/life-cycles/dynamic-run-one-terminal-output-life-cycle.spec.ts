import { stripVTControlCharacters } from 'util';
import { Task } from '../../config/task-graph';
import type { TaskMetadata } from '../life-cycle';
import { createRunOneDynamicOutputRenderer } from './dynamic-run-one-terminal-output-life-cycle';

function makeTask(project: string, target: string): Task {
  return {
    id: `${project}:${target}`,
    target: { project, target },
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

describe('createRunOneDynamicOutputRenderer', () => {
  let processOn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    processOn = vi.spyOn(process, 'on').mockImplementation(() => process);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['skipped', false, ['✖  1/2 failed', '⏭  1/2 skipped']],
    [
      'stopped or not started after a signal',
      true,
      ['✖  0/2 failed', '…  1/2 were in progress', '…  1/2 had not started'],
    ],
  ])(
    'counts against the total and reports tasks that never finished as %s',
    async (_, signalled, expectedLines) => {
      const target = makeTask('app', 'build');
      const dep = makeTask('lib', 'build');

      const out = await captureOutput(async () => {
        const { lifeCycle, renderIsDone } =
          await createRunOneDynamicOutputRenderer({
            initiatingProject: 'app',
            tasks: [target, dep],
            args: {},
            overrides: {},
          });
        lifeCycle.startTasks([dep], {} as TaskMetadata);
        if (signalled) {
          const [, onSigterm] = processOn.mock.calls.find(
            ([event]) => event === 'SIGTERM'
          );
          onSigterm();
          lifeCycle.endTasks(
            [{ task: dep, status: 'stopped', code: 143 }],
            {} as TaskMetadata
          );
        } else {
          lifeCycle.printTaskTerminalOutput(dep, 'failure', 'boom');
          lifeCycle.endTasks(
            [{ task: dep, status: 'failure', code: 1 }],
            {} as TaskMetadata
          );
        }
        lifeCycle.endCommand();
        await renderIsDone;
      });

      expect(out).toContain('✔  0/2 succeeded');
      for (const line of expectedLines) {
        expect(out).toContain(line);
      }
    }
  );
});
