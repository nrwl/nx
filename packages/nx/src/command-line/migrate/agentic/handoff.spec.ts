import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  initRunDir,
  readHandoff,
  runDirPath,
  stepHandoffPath,
  stepIdFor,
} from './handoff';

describe('handoff', () => {
  let workspace: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'nx-agentic-handoff-'));
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  describe('runDirPath', () => {
    it('joins workspace + .nx/agentic + run id', () => {
      expect(runDirPath('/abs/ws', '23.0.0')).toBe(
        join('/abs/ws', '.nx', 'agentic', '23.0.0')
      );
    });
  });

  describe('initRunDir', () => {
    it('creates the directory when it does not exist', () => {
      const dir = initRunDir(workspace, '23.0.0');
      expect(existsSync(dir)).toBe(true);
      expect(dir).toBe(join(workspace, '.nx', 'agentic', '23.0.0'));
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

  describe('stepIdFor', () => {
    it('combines package + name with double underscore', () => {
      expect(stepIdFor({ package: '@nx/storybook', name: 'migrate-css' })).toBe(
        '_nx_storybook__migrate-css'
      );
    });

    it('replaces filesystem-unsafe characters with underscore', () => {
      expect(stepIdFor({ package: 'a/b:c', name: 'x y' })).toBe('a_b_c__x_y');
    });
  });

  describe('stepHandoffPath', () => {
    it('appends `<stepId>.json` to the run dir', () => {
      expect(stepHandoffPath('/abs/ws/.nx/agentic/23.0.0', 'pkg__name')).toBe(
        join('/abs/ws/.nx/agentic/23.0.0', 'pkg__name.json')
      );
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

    it('parses a success handoff with status + summary', () => {
      const file = join(workspace, 'ok.json');
      writeFileSync(
        file,
        JSON.stringify({ status: 'success', summary: 'all good' })
      );
      expect(readHandoff(file)).toEqual({
        status: 'success',
        summary: 'all good',
      });
    });

    it('parses a failed handoff with status + summary', () => {
      const file = join(workspace, 'bad.json');
      writeFileSync(
        file,
        JSON.stringify({ status: 'failed', summary: 'broken' })
      );
      expect(readHandoff(file)).toEqual({
        status: 'failed',
        summary: 'broken',
      });
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

  it('reads from a real on-disk write end-to-end', () => {
    const runDir = initRunDir(workspace, '23.0.0');
    const stepId = stepIdFor({ package: '@nx/storybook', name: 'migrate-css' });
    const file = stepHandoffPath(runDir, stepId);
    writeFileSync(
      file,
      JSON.stringify({ status: 'success', summary: 'applied' })
    );
    // Sanity: written content survives the round-trip via readHandoff.
    expect(JSON.parse(readFileSync(file, 'utf-8'))).toEqual({
      status: 'success',
      summary: 'applied',
    });
    expect(readHandoff(file)).toEqual({
      status: 'success',
      summary: 'applied',
    });
  });
});
