import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  initRunDir,
  mkdirSafely,
  readHandoff,
  readHandoffWithReason,
  stepHandoffPath,
  waitForValidHandoff,
} from './handoff';

describe('handoff', () => {
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'nx-agentic-handoff-'));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  describe('mkdirSafely', () => {
    it('preserves the original ErrnoException as `cause` so callers can read .code / .path / .syscall', () => {
      // Force a cross-platform real failure: write a regular file in the
      // tmp workspace, then try to mkdir UNDER it. Every supported Node
      // platform (Linux / macOS / Windows) rejects this with an
      // ErrnoException carrying `.code` ('ENOTDIR' on POSIX, 'ENOENT'
      // on Windows) plus `.path` and `.syscall: 'mkdir'`. The wrapper
      // must preserve the original via `{ cause }` instead of
      // synthesizing a fresh Error from its message.
      const regularFile = join(workspace, 'not-a-directory');
      writeFileSync(regularFile, '');
      let caught: unknown;
      try {
        mkdirSafely(join(regularFile, 'child'), 'test');
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(Error);
      const wrapper = caught as Error & { cause?: unknown };
      expect(wrapper.message).toContain('Could not create test');
      // `wrapper.cause` is the original ErrnoException from fs. Inspect
      // its fields directly — `instanceof Error` can be flaky across the
      // Node fs realm in some environments, but `.code` / `.syscall` are
      // structural and reliable.
      const cause = wrapper.cause as
        | (NodeJS.ErrnoException & { syscall?: string })
        | undefined;
      expect(cause).toBeDefined();
      expect(cause?.code).toBeTruthy();
      expect(cause?.syscall).toBe('mkdir');
    });
  });

  describe('initRunDir', () => {
    it('creates the directory when it does not exist', () => {
      const dir = initRunDir(workspace, '23.0.0');
      expect(existsSync(dir)).toBe(true);
      expect(dir).toBe(join(workspace, '.nx', 'migrate-runs', '23.0.0'));
    });

    it('wipes only the target run-id directory, leaving other runs untouched', () => {
      const dirA = initRunDir(workspace, '23.0.0');
      writeFileSync(join(dirA, 'step-a.json'), '{}');
      const dirB = initRunDir(workspace, '22.5.0');
      writeFileSync(join(dirB, 'step-b.json'), '{}');

      initRunDir(workspace, '23.0.0');

      expect(existsSync(join(dirA, 'step-a.json'))).toBe(false);
      expect(existsSync(join(dirB, 'step-b.json'))).toBe(true);
    });
  });

  describe('stepHandoffPath', () => {
    it('treats the package scope as a subdirectory', () => {
      expect(
        stepHandoffPath('/run', {
          package: '@nx/storybook',
          name: 'migrate-css',
        })
      ).toBe(join('/run', '@nx', 'storybook', 'migrate-css.json'));
    });

    it('uses a single segment for unscoped packages', () => {
      expect(
        stepHandoffPath('/run', { package: 'plain-pkg', name: 'm1-gen' })
      ).toBe(join('/run', 'plain-pkg', 'm1-gen.json'));
    });

    it('replaces path-traversal segments with `_` so a malformed name cannot escape the run dir', () => {
      expect(
        stepHandoffPath('/run', { package: '@nx/react', name: '..' })
      ).toBe(join('/run', '@nx', 'react', '_.json'));
      expect(
        stepHandoffPath('/run', {
          package: '../escape',
          name: 'm1',
        })
      ).toBe(join('/run', '_', 'escape', 'm1.json'));
    });

    it('replaces Windows-reserved and control characters with `_`', () => {
      expect(
        stepHandoffPath('/run', {
          package: '@scope/pkg',
          name: 'bad:name*with?chars',
        })
      ).toBe(join('/run', '@scope', 'pkg', 'bad_name_with_chars.json'));
      expect(
        stepHandoffPath('/run', {
          package: '@scope/pkg',
          name: 'has/slash\\and|pipe',
        })
      ).toBe(join('/run', '@scope', 'pkg', 'has_slash_and_pipe.json'));
    });

    it('strips trailing dots/spaces (Windows file-naming rule)', () => {
      expect(
        stepHandoffPath('/run', {
          package: '@scope/pkg',
          name: 'trailing.   ',
        })
      ).toBe(join('/run', '@scope', 'pkg', 'trailing.json'));
    });

    it.each([
      ['CON', '_CON'],
      ['con', '_con'],
      ['NUL', '_NUL'],
      ['COM1', '_COM1'],
      ['LPT9', '_LPT9'],
      ['aux', '_aux'],
      ['CON.bak', '_CON.bak'],
    ])(
      'prefixes Windows reserved device name "%s" so the resulting filename is writable',
      (input, expected) => {
        expect(
          stepHandoffPath('/run', { package: '@scope/pkg', name: input })
        ).toBe(join('/run', '@scope', 'pkg', `${expected}.json`));
      }
    );

    it.each(['CONsole', 'PRNTASK', 'COM10', 'LPT', 'conform'])(
      'leaves non-reserved names that merely start with a reserved prefix untouched ("%s")',
      (input) => {
        expect(
          stepHandoffPath('/run', { package: '@scope/pkg', name: input })
        ).toBe(join('/run', '@scope', 'pkg', `${input}.json`));
      }
    );
  });

  describe('readHandoff', () => {
    it.each([
      ['success', { status: 'success', summary: 'all good' }],
      ['failed', { status: 'failed', summary: 'broken' }],
    ])('parses a %s handoff with status + summary', (_label, payload) => {
      const file = join(workspace, `${_label}.json`);
      writeFileSync(file, JSON.stringify(payload));
      expect(readHandoff(file)).toEqual(payload);
    });

    it('preserves extra fields in `extras`', () => {
      const file = join(workspace, 'extras.json');
      writeFileSync(
        file,
        JSON.stringify({
          status: 'success',
          summary: 'done',
          changedFiles: ['a.ts'],
          notes: 'fyi',
        })
      );
      expect(readHandoff(file)).toEqual({
        status: 'success',
        summary: 'done',
        extras: { changedFiles: ['a.ts'], notes: 'fyi' },
      });
    });
  });

  describe('readHandoffWithReason — prototype-pollution defense', () => {
    it('rebuilds `extras` on a null-prototype object so a hostile `__proto__` key cannot pollute', () => {
      const file = join(workspace, 'handoff.json');
      // Write the JSON as a raw string so `__proto__` lands as a real
      // JSON key. Using `JSON.stringify({ __proto__: ... })` would not
      // work because object-literal `__proto__` syntax sets the prototype
      // chain (so `JSON.stringify` silently drops it from the output).
      // Only a hand-written JSON document can force `JSON.parse` to
      // materialize `__proto__` as an own enumerable property.
      writeFileSync(
        file,
        '{"status":"success","summary":"ok","custom":"data","__proto__":{"polluted":true}}'
      );

      const result = readHandoffWithReason(file);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // `__proto__` survives as an own data key on a null-prototype
      // container; its presence does NOT affect Object.prototype.
      const extras = result.handoff.extras!;
      expect(Object.getPrototypeOf(extras)).toBeNull();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      expect(extras.custom).toBe('data');
      // The own-key survives (we don't filter — we just contain).
      expect(Object.keys(extras)).toEqual(
        expect.arrayContaining(['custom', '__proto__'])
      );
    });
  });

  describe('readHandoffWithReason', () => {
    it('returns a missing reason when the file does not exist', () => {
      const result = readHandoffWithReason(join(workspace, 'nope.json'));
      expect(result).toEqual({ ok: false, reason: 'missing' });
    });

    it('returns a parse-error reason with detail when JSON is malformed', () => {
      const file = join(workspace, 'broken.json');
      writeFileSync(file, '{ not json');
      const result = readHandoffWithReason(file);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('parse-error');
        expect(result.detail).toBeTruthy();
      }
    });

    it('returns a shape-mismatch reason for a valid JSON without `summary`', () => {
      const file = join(workspace, 'shape.json');
      writeFileSync(file, JSON.stringify({ status: 'success' }));
      const result = readHandoffWithReason(file);
      expect(result).toEqual({ ok: false, reason: 'shape-mismatch' });
    });

    it('returns a shape-mismatch reason for an unknown `status` value', () => {
      const file = join(workspace, 'status.json');
      writeFileSync(file, JSON.stringify({ status: 'maybe', summary: 'x' }));
      const result = readHandoffWithReason(file);
      expect(result).toEqual({ ok: false, reason: 'shape-mismatch' });
    });
  });

  describe('waitForValidHandoff', () => {
    it('keeps polling past invalid contents and resolves once the file becomes a valid handoff', async () => {
      const file = join(workspace, 'h.json');
      writeFileSync(file, '{ partial');
      const promise = waitForValidHandoff(file, { intervalMs: 10 });
      setTimeout(() => {
        writeFileSync(
          file,
          JSON.stringify({ status: 'success', summary: 'ok' })
        );
      }, 30);
      await expect(promise).resolves.toBeUndefined();
    });

    it('rejects with the abort reason when the signal is aborted mid-poll', async () => {
      const file = join(workspace, 'h.json');
      const ac = new AbortController();
      const promise = waitForValidHandoff(file, {
        intervalMs: 10,
        signal: ac.signal,
      });
      setTimeout(() => ac.abort(new Error('cancel')), 20);
      await expect(promise).rejects.toThrow('cancel');
    });

    it('rejects immediately when the signal is already aborted', async () => {
      const file = join(workspace, 'h.json');
      const ac = new AbortController();
      ac.abort(new Error('already-cancelled'));
      await expect(
        waitForValidHandoff(file, { intervalMs: 10, signal: ac.signal })
      ).rejects.toThrow('already-cancelled');
    });
  });
});
