import { format } from 'node:util';
import { logger } from '../../../utils/logger';

/**
 * Tees `console.{log,warn,error,info,debug}` into an internal buffer while
 * preserving the original behavior. Does not intercept
 * `process.{stdout,stderr}.write` — those bypass `console` and would also
 * pick up unrelated framework output. Restoration is idempotent.
 */
export interface GeneratorOutputCapture {
  flush(): string;
  restore(): void;
}

type ConsoleMethod = 'log' | 'warn' | 'error' | 'info' | 'debug';
const CONSOLE_METHODS: ConsoleMethod[] = [
  'log',
  'warn',
  'error',
  'info',
  'debug',
];

// Marks `console[method]` as a wrapper installed by this module. Seeing it on
// entry means the previous install never restored — refuse rather than layer,
// otherwise the leak compounds silently into a wrapper-wrapping-a-wrapper.
const CAPTURED_MARKER = Symbol.for('nx-migrate.generator-output-captured');

const NOOP_CAPTURE: GeneratorOutputCapture = {
  flush: () => '',
  restore: () => {},
};

export function installGeneratorOutputCapture(): GeneratorOutputCapture {
  // Refuse to layer if the previous install never restored. Returns a noop
  // handle so callers' `flush()` / `restore()` calls remain safe.
  for (const method of CONSOLE_METHODS) {
    if ((console[method] as { [CAPTURED_MARKER]?: true })[CAPTURED_MARKER]) {
      logger.verbose(
        `nx migrate: refusing to layer a second generator-output capture; the previous one was not restored. This typically means a caller skipped its \`try/finally\` — the outer capture's output will not include this run.`
      );
      return NOOP_CAPTURE;
    }
  }

  const buffer: string[] = [];
  const originals = new Map<ConsoleMethod, Console[ConsoleMethod]>();

  for (const method of CONSOLE_METHODS) {
    originals.set(method, console[method]);
    const original = console[method].bind(console);
    const wrapper = ((...args: unknown[]) => {
      original(...args);
      try {
        buffer.push(format(...args));
      } catch {
        // `format` is robust against the common pathologies but a user arg
        // with a throwing `toString()` would otherwise turn a benign
        // `console.log(...)` into a generator crash.
      }
    }) as Console[ConsoleMethod] & { [CAPTURED_MARKER]?: true };
    Object.defineProperty(wrapper, CAPTURED_MARKER, {
      value: true,
      enumerable: false,
      configurable: true,
      writable: false,
    });
    console[method] = wrapper;
  }

  let restored = false;
  return {
    flush(): string {
      return buffer.join('\n');
    },
    restore(): void {
      if (restored) return;
      restored = true;
      for (const [method, fn] of originals) {
        console[method] = fn;
      }
    },
  };
}

/**
 * Convenience wrapper that installs the capture, runs `fn`, restores on
 * completion or throw, and returns the captured logs alongside `fn`'s value.
 * Throws from `fn` propagate with the captured logs attached as
 * `(err as any).capturedLogs` — the most useful diagnostic when a generator
 * crashes mid-output.
 */
export async function withGeneratorOutputCapture<T>(
  fn: () => Promise<T> | T
): Promise<{ result: T; logs: string }> {
  const capture = installGeneratorOutputCapture();
  try {
    const result = await fn();
    return { result, logs: capture.flush() };
  } catch (err) {
    if (err && typeof err === 'object') {
      // A frozen / sealed / non-extensible error would make this throw a
      // TypeError under TS-emitted strict-mode code, masking the original
      // generator error. Swallow that failure; the diagnostic is best-effort.
      try {
        (err as { capturedLogs?: string }).capturedLogs = capture.flush();
      } catch {
        /* attachment failed; preserve the original error */
      }
    }
    throw err;
  } finally {
    capture.restore();
  }
}
