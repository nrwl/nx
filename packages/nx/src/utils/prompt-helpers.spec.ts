import { syncBuiltinESMExports } from 'node:module';
import { PassThrough } from 'node:stream';
import { confirmationPrompt, selectPrompt, textPrompt } from './prompt-helpers';

class FakeTty extends PassThrough {
  isTTY = true;
  columns = 80;
  rows = 24;
  rawModes: boolean[] = [];
  setRawMode(mode: boolean) {
    this.rawModes.push(mode);
    return this;
  }
}

describe('prompt-helpers on a TTY', () => {
  const stdinDescriptor = Object.getOwnPropertyDescriptor(process, 'stdin');
  const stdoutDescriptor = Object.getOwnPropertyDescriptor(process, 'stdout');
  let stdin: FakeTty;
  let errors: unknown[];
  const recordError = (error: unknown) => errors.push(error);

  beforeEach(() => {
    stdin = new FakeTty();
    const stdout = new FakeTty();
    stdout.resume();
    Object.defineProperty(process, 'stdin', {
      value: stdin,
      configurable: true,
    });
    Object.defineProperty(process, 'stdout', {
      value: stdout,
      configurable: true,
    });

    // clack binds `stdin`/`stdout` from `node:process`, which only sees the
    // fakes once the builtin's ESM exports are resynced.
    syncBuiltinESMExports();

    errors = [];
    process.on('uncaughtException', recordError);
    process.on('unhandledRejection', recordError);
  });

  afterEach(() => {
    process.off('uncaughtException', recordError);
    process.off('unhandledRejection', recordError);
    Object.defineProperty(process, 'stdin', stdinDescriptor);
    Object.defineProperty(process, 'stdout', stdoutDescriptor);
    syncBuiltinESMExports();
  });

  async function press(keys: string) {
    await vi.waitFor(() => {
      if (stdin.listenerCount('keypress') === 0) {
        throw new Error('no prompt is listening');
      }
    });
    stdin.write(keys);
  }

  it('answers prompts, then cancels one on Ctrl-C and releases the TTY', async () => {
    const select = selectPrompt({ message: 'Pick', choices: ['a', 'b'] });
    await press('\x1b[B');
    await press('\r');
    expect(await select).toBe('b');

    const confirm = confirmationPrompt({ message: 'Sure?' });
    await press('\r');
    expect(await confirm).toBe(true);

    const text = textPrompt({
      message: 'Name',
      onCancel: () => 'cancelled',
    });
    await press('ab');
    await press('\x03');
    expect(await text).toBe('cancelled');

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(errors).toEqual([]);
    expect(stdin.listenerCount('keypress')).toBe(0);
    expect(stdin.rawModes.at(-1)).toBe(false);
  });
});
