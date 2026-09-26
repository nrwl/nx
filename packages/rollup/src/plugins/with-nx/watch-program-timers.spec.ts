import type * as TypeScript from 'typescript';
import { clearTimersOnClose } from './watch-program-timers';

describe('clearTimersOnClose', () => {
  let fired: jest.Mock;
  let closed: jest.Mock;
  let ts: typeof TypeScript;

  beforeEach(() => {
    jest.useFakeTimers();
    fired = jest.fn();
    closed = jest.fn();
    // Stands in for TypeScript: arms the program-update timer the way
    // `createWatchProgram` does on a watch event, and returns the program.
    ts = clearTimersOnClose({
      sys: { name: 'sys' },
      createWatchProgram: (host) => {
        host.setTimeout?.(fired, 250, 'timerToUpdateProgram');
        return { close: closed };
      },
    } as unknown as typeof TypeScript);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function host() {
    return {
      setTimeout,
      clearTimeout,
    } as unknown as TypeScript.WatchCompilerHostOfFilesAndCompilerOptions<TypeScript.BuilderProgram>;
  }

  it('clears a timer the program armed when the program is closed', () => {
    const program = ts.createWatchProgram(host());

    program.close();
    jest.advanceTimersByTime(1000);

    expect(closed).toHaveBeenCalledTimes(1);
    expect(fired).not.toHaveBeenCalled();
  });

  it('lets the timer fire while the program is open', () => {
    ts.createWatchProgram(host());

    jest.advanceTimersByTime(250);

    expect(fired).toHaveBeenCalledWith('timerToUpdateProgram');
  });

  it('leaves a host without timers alone', () => {
    const bare =
      {} as TypeScript.WatchCompilerHostOfFilesAndCompilerOptions<TypeScript.BuilderProgram>;

    const program = ts.createWatchProgram(bare);
    program.close();

    expect(bare.setTimeout).toBeUndefined();
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('exposes the rest of TypeScript unchanged', () => {
    expect((ts as any).sys).toEqual({ name: 'sys' });
  });
});
