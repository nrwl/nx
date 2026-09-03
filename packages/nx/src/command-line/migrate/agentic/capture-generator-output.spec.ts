import {
  installGeneratorOutputCapture,
  MARKER_BYTES,
  MAX_GENERATOR_OUTPUT_BYTES,
  withGeneratorOutputCapture,
} from './capture-generator-output';
import { logger } from '../../../utils/logger';

describe('generator output capture', () => {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;
  const originalDebug = console.debug;

  afterEach(() => {
    vi.restoreAllMocks();
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    console.info = originalInfo;
    console.debug = originalDebug;
  });

  describe('installGeneratorOutputCapture', () => {
    it('captures console.log/warn/error/info/debug while still writing to the original methods', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      const capture = installGeneratorOutputCapture();
      console.log('a');
      console.warn('b');
      console.error('c');
      console.info('d');
      console.debug('e');
      const captured = capture.flush();
      capture.restore();

      expect(captured.split('\n')).toEqual(['a', 'b', 'c', 'd', 'e']);
      expect(logSpy).toHaveBeenCalledWith('a');
      expect(warnSpy).toHaveBeenCalledWith('b');
      expect(errorSpy).toHaveBeenCalledWith('c');
      expect(infoSpy).toHaveBeenCalledWith('d');
      expect(debugSpy).toHaveBeenCalledWith('e');
    });

    it('formats multi-arg and non-string values like console would', () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const capture = installGeneratorOutputCapture();
      console.log('count =', 3);
      console.log({ a: 1, b: 'two' });
      const captured = capture.flush();
      capture.restore();

      expect(captured).toContain('count = 3');
      expect(captured).toContain("{ a: 1, b: 'two' }");
    });

    it('restores the original methods', () => {
      const capture = installGeneratorOutputCapture();
      expect(console.log).not.toBe(originalLog);
      capture.restore();
      expect(console.log).toBe(originalLog);
    });

    it('restore is idempotent', () => {
      const capture = installGeneratorOutputCapture();
      capture.restore();
      capture.restore();
      expect(console.log).toBe(originalLog);
    });

    it('refuses to layer a second install when the first was not restored, returning a noop handle', () => {
      const verboseSpy = vi
        .spyOn(logger, 'verbose')
        .mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const outer = installGeneratorOutputCapture();
      // Capture the wrapper we just installed; the inner install must NOT
      // replace it (otherwise restore order would un-wrap the outer's
      // wrapper but reinstate the inner's "original", which IS the outer
      // wrapper — a permanent leak).
      const outerWrapper = console.log;

      const inner = installGeneratorOutputCapture();
      console.log('hidden from inner');

      expect(console.log).toBe(outerWrapper);
      expect(verboseSpy).toHaveBeenCalledWith(
        expect.stringContaining('refusing to layer a second')
      );

      // The inner returns a noop handle — flush is empty, restore is a
      // safe no-op that doesn't disturb the outer.
      expect(inner.flush()).toBe('');
      inner.restore();
      expect(console.log).toBe(outerWrapper);

      // Outer remains functional.
      expect(outer.flush()).toContain('hidden from inner');
      outer.restore();
      expect(logSpy).toHaveBeenCalledWith('hidden from inner');
    });
  });

  describe('output cap', () => {
    const marker = /\[nx migrate: (\d+) bytes of generator output omitted\]/;
    const bytes = (value: string) => Buffer.byteLength(value);

    function captured(emit: () => void): string {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const capture = installGeneratorOutputCapture();
      try {
        emit();
        return capture.flush();
      } finally {
        capture.restore();
      }
    }

    it('returns output under the cap whole, without a marker', () => {
      const lines = Array.from({ length: 160 }, (_, i) =>
        `line-${i}`.padEnd(99, '.')
      );
      const flushed = captured(() => lines.forEach((l) => console.log(l)));

      expect(bytes(flushed)).toBeLessThanOrEqual(MAX_GENERATOR_OUTPUT_BYTES);
      expect(flushed).toBe(lines.join('\n'));
    });

    it.each([
      ['ASCII lines', () => 'x'.repeat(100), 20_000],
      ['multibyte lines', () => 'é'.repeat(100), 20_000],
      ['CRLF lines', () => 'a\r\nb\r\n', 20_000],
      ['a single line with no newline', () => 'y'.repeat(1024 * 1024), 1],
      ['empty calls', () => '', 20_000],
      ['one-character calls', () => 'z', 20_000],
    ])('bounds %s to the cap and points at the omission', (_, line, calls) => {
      const flushed = captured(() => {
        for (let i = 0; i < calls; i++) console.log(line());
      });

      expect(bytes(flushed)).toBeLessThanOrEqual(MAX_GENERATOR_OUTPUT_BYTES);
      expect(flushed).toMatch(marker);
    });

    it('keeps the first lines, the last line, and counts the dropped ones', () => {
      const lines = Array.from({ length: 2000 }, (_, i) =>
        `line-${String(i).padStart(5, '0')}`.padEnd(16, '.')
      );
      const flushed = captured(() => lines.forEach((l) => console.log(l)));

      expect(flushed.startsWith(lines[0])).toBe(true);
      expect(flushed.endsWith(lines[lines.length - 1])).toBe(true);
      const dropped = lines.filter((l) => !flushed.includes(l));
      expect(dropped.length).toBeGreaterThan(0);
      expect(Number(flushed.match(marker)[1])).toBe(
        dropped.reduce((sum, l) => sum + bytes(l) + 1, 0)
      );
    });

    it('cuts an oversized line on code-point boundaries at both ends', () => {
      const flushed = captured(() => console.log('€'.repeat(100_000)));

      expect(bytes(flushed)).toBeLessThanOrEqual(MAX_GENERATOR_OUTPUT_BYTES);
      const [head, tail] = flushed.split(marker.exec(flushed)[0]);
      expect(head).toMatch(/^€+\n$/);
      expect(tail).toMatch(/^\n€+$/);
      expect(flushed).not.toContain('�');
    });

    it('keeps a lone low surrogate that fits at the tail cut', () => {
      // 4096 bytes fill the head; the rest overflows the tail by one byte, so
      // the cut lands between `A` and the lone surrogate.
      const flushed = captured(() =>
        console.log('h'.repeat(4096) + 'A\uDC00' + 'x'.repeat(12211))
      );

      expect(bytes(flushed)).toBeLessThanOrEqual(MAX_GENERATOR_OUTPUT_BYTES);
      expect(flushed.match(marker)[1]).toBe('1');
      expect(flushed.split(marker.exec(flushed)[0])[1]).toMatch(/^\n\uDC00x/);
    });

    it('reserves the marker at the widest number spelling', () => {
      for (const count of [Number.MAX_VALUE, Infinity, 1e21 + 131072]) {
        expect(MARKER_BYTES).toBeGreaterThanOrEqual(
          bytes(`\n[nx migrate: ${count} bytes of generator output omitted]\n`)
        );
      }
    });

    it('stays within the cap while the omitted count gains a digit', () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const capture = installGeneratorOutputCapture();
      const digits = new Set<number>();
      for (let i = 0; i < 2000; i++) {
        console.log(`line-${String(i).padStart(5, '0')}`.padEnd(16, '.'));
        const flushed = capture.flush();
        expect(bytes(flushed)).toBeLessThanOrEqual(MAX_GENERATOR_OUTPUT_BYTES);
        const count = flushed.match(marker)?.[1];
        if (count) digits.add(count.length);
      }
      capture.restore();

      expect([...digits].sort()).toEqual([2, 3, 4, 5]);
    });

    it('flushes the same bounded output repeatedly', () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const capture = installGeneratorOutputCapture();
      for (let i = 0; i < 1000; i++) console.log('w'.repeat(100));
      const first = capture.flush();
      expect(capture.flush()).toBe(first);
      console.log('after');
      const second = capture.flush();
      capture.restore();

      expect(second).not.toBe(first);
      expect(bytes(second)).toBeLessThanOrEqual(MAX_GENERATOR_OUTPUT_BYTES);
      expect(second.endsWith('after')).toBe(true);
    });
  });

  describe('withGeneratorOutputCapture', () => {
    it('returns the function result and the captured logs', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const { result, logs } = await withGeneratorOutputCapture(async () => {
        console.log('inside');
        return 42;
      });

      expect(result).toBe(42);
      expect(logs).toContain('inside');
    });

    it('restores the console on throw', async () => {
      const before = console.log;

      await expect(
        withGeneratorOutputCapture(() => {
          throw new Error('boom');
        })
      ).rejects.toThrow('boom');

      expect(console.log).toBe(before);
    });

    it('attaches captured logs to the thrown error as `capturedLogs`', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      let captured: unknown;
      try {
        await withGeneratorOutputCapture(() => {
          console.log('progress line 1');
          console.log('progress line 2');
          throw new Error('boom');
        });
      } catch (err) {
        captured = err;
      }
      const errWithLogs = captured as Error & { capturedLogs?: string };
      expect(errWithLogs).toBeInstanceOf(Error);
      expect(errWithLogs.capturedLogs).toContain('progress line 1');
      expect(errWithLogs.capturedLogs).toContain('progress line 2');
    });

    it('does not crash when a captured user arg has a throwing toString()', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const hostile = {
        toString() {
          throw new Error('toString blew up');
        },
      };

      // `%s` forces `util.format` to coerce `hostile` via `String(hostile)`,
      // which routes through `toString()`. Without the try/catch around
      // `format(...)` inside the capture wrapper, that would propagate.
      const { result } = await withGeneratorOutputCapture(() => {
        console.log('%s', hostile);
        return 'ok';
      });
      expect(result).toBe('ok');
    });

    it('does not mask the original error when attaching capturedLogs would throw', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const original = new Error('original failure');
      Object.freeze(original);

      let caught: unknown;
      try {
        await withGeneratorOutputCapture(() => {
          console.log('progress before crash');
          throw original;
        });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBe(original);
      expect((caught as Error).message).toBe('original failure');
      // Attachment was silently dropped; the diagnostic is best-effort.
      expect(
        (caught as { capturedLogs?: string }).capturedLogs
      ).toBeUndefined();
    });
  });
});
