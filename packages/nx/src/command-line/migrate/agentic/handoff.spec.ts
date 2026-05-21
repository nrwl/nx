import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  initRunDir,
  readHandoff,
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
  });

  describe('readHandoff', () => {
    it('returns null when the file is missing', () => {
      expect(readHandoff(join(workspace, 'nope.json'))).toBeNull();
    });

    it('returns null on invalid JSON', () => {
      const file = join(workspace, 'bad.json');
      writeFileSync(file, '{ not json');
      expect(readHandoff(file)).toBeNull();
    });

    it('returns null when status is not "success" or "failed"', () => {
      const file = join(workspace, 'bad-status.json');
      writeFileSync(
        file,
        JSON.stringify({ status: 'in-progress', summary: 'wip' })
      );
      expect(readHandoff(file)).toBeNull();
    });

    it('returns null when summary is missing or non-string', () => {
      const file = join(workspace, 'bad-summary.json');
      writeFileSync(file, JSON.stringify({ status: 'success', summary: 42 }));
      expect(readHandoff(file)).toBeNull();
    });

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
