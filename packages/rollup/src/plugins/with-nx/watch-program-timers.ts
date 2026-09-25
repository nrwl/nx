import type * as TypeScript from 'typescript';

type Timer = ReturnType<typeof setTimeout>;

/**
 * Returns TypeScript with a `createWatchProgram` whose programs clear the
 * timers they armed when they are closed.
 *
 * `@rollup/plugin-typescript` runs a watch program for a one-shot build and
 * closes it in `buildEnd`. TypeScript's `close()` stops the file watchers but
 * leaves `timerToUpdateProgram` running (`src/compiler/watchPublic.ts`), so a
 * change to any watched path in the last 250 ms of the build fires it after
 * the close. The update rebuilds the program, with every file watcher it had,
 * and nothing closes those again: `rollup -c` prints its output and never
 * exits. The plugin takes the TypeScript module as an option, so the timers
 * are cleared from here.
 */
export function clearTimersOnClose(ts: typeof TypeScript): typeof TypeScript {
  return Object.create(ts, {
    createWatchProgram: {
      value(
        host: TypeScript.WatchCompilerHostOfFilesAndCompilerOptions<TypeScript.BuilderProgram>
      ) {
        const pending = new Set<Timer>();
        const { setTimeout: schedule, clearTimeout: cancel } = host;
        if (schedule && cancel) {
          host.setTimeout = (callback, ms, ...args) => {
            const timer: Timer = schedule(() => {
              pending.delete(timer);
              callback(...args);
            }, ms);
            pending.add(timer);
            return timer;
          };
          host.clearTimeout = (timer) => {
            pending.delete(timer);
            cancel(timer);
          };
        }
        const program = ts.createWatchProgram(host);
        const close = program.close;
        program.close = () => {
          close.call(program);
          pending.forEach((timer) => cancel(timer));
          pending.clear();
        };
        return program;
      },
    },
  });
}
