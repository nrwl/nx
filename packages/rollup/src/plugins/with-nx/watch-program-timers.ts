import type * as TypeScript from 'typescript';

type Timer = ReturnType<typeof setTimeout>;

/**
 * Returns TypeScript with a `createWatchProgram` whose programs clear the
 * timers they armed when they are closed.
 *
 * TypeScript's `close()` does not cancel a pending program-update timer.
 * If it fires after close, it can recreate file watchers and keep a
 * one-shot Rollup process alive.
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
