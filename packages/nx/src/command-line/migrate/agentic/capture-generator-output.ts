import { format } from 'node:util';

/**
 * Tees every line written to `console.{log,warn,error,info,debug}` into an
 * internal buffer while preserving the original behavior (the line still
 * reaches the original stream). `nx/src/utils/logger`'s `logger` ultimately
 * delegates to `console`, so a generator using either the devkit `logger` or
 * `console` directly is captured here.
 *
 * Stops short of intercepting `process.stdout.write` / `process.stderr.write`:
 * those bypass `console` and would also pick up unrelated framework output.
 * Migration generators in practice use the devkit logger or `console`.
 *
 * Restoration is idempotent. Callers should wrap their invocation in
 * `try/finally` (or use the helper below) so the patch is reverted on throw.
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

export function installGeneratorOutputCapture(): GeneratorOutputCapture {
  const buffer: string[] = [];
  const originals = new Map<ConsoleMethod, Console[ConsoleMethod]>();

  for (const method of CONSOLE_METHODS) {
    originals.set(method, console[method]);
    const original = console[method].bind(console);
    console[method] = ((...args: unknown[]) => {
      original(...args);
      buffer.push(format(...args));
    }) as Console[ConsoleMethod];
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
 * Throws from `fn` propagate; the captured logs are discarded on throw.
 */
export async function withGeneratorOutputCapture<T>(
  fn: () => Promise<T> | T
): Promise<{ result: T; logs: string }> {
  const capture = installGeneratorOutputCapture();
  try {
    const result = await fn();
    return { result, logs: capture.flush() };
  } finally {
    capture.restore();
  }
}
