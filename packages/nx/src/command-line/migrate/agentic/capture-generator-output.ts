import { format } from 'node:util';
import { logger } from '../../../utils/logger';
import { truncateUtf8 } from './handoff';

/**
 * Tees `console.{log,warn,error,info,debug}` into an internal buffer while
 * preserving the original behavior. Does not intercept
 * `process.{stdout,stderr}.write` — those bypass `console` and would also
 * pick up unrelated framework output. Restoration is idempotent.
 *
 * `flush()` returns at most `MAX_GENERATOR_OUTPUT_BYTES`: up to the first
 * `HEAD_BYTES` of output, a marker with the omitted byte count, and the most
 * recent output. The terminal still receives everything through the tee.
 */
export interface GeneratorOutputCapture {
  flush(): string;
  restore(): void;
}

export const MAX_GENERATOR_OUTPUT_BYTES = 16384;
const HEAD_BYTES = 4096;
const omittedMarker = (omitted: number | string) =>
  `[nx migrate: ${omitted} bytes of generator output omitted]`;
// Reserved at the widest number spelling so a growing count cannot push a
// flush over the cap.
export const MARKER_BYTES = Buffer.byteLength(
  `\n${omittedMarker(Number.MAX_VALUE)}\n`
);
const TAIL_BYTES = MAX_GENERATOR_OUTPUT_BYTES - HEAD_BYTES - MARKER_BYTES;

// Keeps the last `maxBytes` of `value`, cut on a code point.
function keepTailUtf8(value: string, maxBytes: number): string {
  let start = value.length;
  let kept = 0;
  while (start > 0) {
    const low = value.charCodeAt(start - 1);
    const high = start > 1 ? value.charCodeAt(start - 2) : 0;
    const from =
      low >= 0xdc00 && low <= 0xdfff && high >= 0xd800 && high <= 0xdbff
        ? start - 2
        : start - 1;
    const bytes = Buffer.byteLength(value.slice(from, start));
    if (kept + bytes > maxBytes) break;
    kept += bytes;
    start = from;
  }
  return value.slice(start);
}

class BoundedOutput {
  private readonly head: string[] = [];
  private headBytes = 0;
  private headOpen = true;
  // The head ends mid-record, so no newline separates it from the tail.
  private headSplit = false;
  private readonly tail: { text: string; cost: number }[] = [];
  private tailBytes = 0;
  private omitted = 0;

  append(record: string): void {
    if (this.headOpen) {
      const separator = this.head.length ? 1 : 0;
      const bytes = Buffer.byteLength(record);
      if (this.headBytes + separator + bytes <= HEAD_BYTES) {
        this.head.push(record);
        this.headBytes += separator + bytes;
        return;
      }
      this.headOpen = false;
      const prefix = truncateUtf8(
        record,
        HEAD_BYTES - this.headBytes - separator
      );
      if (prefix) {
        this.head.push(prefix);
        this.headBytes += separator + Buffer.byteLength(prefix);
        this.headSplit = true;
        record = record.slice(prefix.length);
      }
    }
    // Each tail record is charged its bytes plus a following newline; the last
    // record's unused newline is one byte of slack at render time.
    const cost = Buffer.byteLength(record) + 1;
    this.tail.push({ text: record, cost });
    this.tailBytes += cost;
    while (this.tailBytes > TAIL_BYTES && this.tail.length > 1) {
      const dropped = this.tail.shift().cost;
      this.tailBytes -= dropped;
      this.omitted += dropped;
    }
    if (this.tailBytes > TAIL_BYTES) {
      const text = keepTailUtf8(this.tail[0].text, TAIL_BYTES - 1);
      const kept = Buffer.byteLength(text) + 1;
      this.omitted += this.tailBytes - kept;
      this.tail[0] = { text, cost: kept };
      this.tailBytes = kept;
    }
  }

  render(): string {
    const head = this.head.join('\n');
    const tail = this.tail.map((record) => record.text).join('\n');
    if (this.omitted > 0) {
      return `${head}\n${omittedMarker(this.omitted)}\n${tail}`;
    }
    if (!this.tail.length) return head;
    return this.headSplit ? head + tail : `${head}\n${tail}`;
  }
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
        `nx migrate: refusing to layer a second generator-output capture; the previous one was not restored. This typically means a caller skipped its \`try/finally\`. The inner caller's \`flush()\` will return empty, but its console output is still being captured by the outer install.`
      );
      return NOOP_CAPTURE;
    }
  }

  const buffer = new BoundedOutput();
  const originals = new Map<ConsoleMethod, Console[ConsoleMethod]>();

  for (const method of CONSOLE_METHODS) {
    originals.set(method, console[method]);
    const original = console[method].bind(console);
    const wrapper = ((...args: unknown[]) => {
      original(...args);
      try {
        buffer.append(format(...args));
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
      return buffer.render();
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
