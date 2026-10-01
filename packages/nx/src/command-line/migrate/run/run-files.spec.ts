import { execFileSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  lockRunFile,
  readRunFile,
  removeRunFile,
  runFileExists,
  writeRunFile,
} from './run-files';

describe('run-files', () => {
  let runDir: string;
  let outside: string;

  beforeEach(() => {
    const base = mkdtempSync(join(tmpdir(), 'nx-migrate-run-files-'));
    runDir = join(base, 'run');
    outside = join(base, 'outside');
    mkdirSync(runDir);
    mkdirSync(outside);
  });

  afterEach(() => {
    rmSync(join(runDir, '..'), { recursive: true, force: true });
  });

  describe('readRunFile', () => {
    it.skipIf(process.platform === 'win32')(
      'refuses a FIFO instead of blocking on it',
      () => {
        const fifo = join(runDir, 'fifo.json');
        execFileSync('mkfifo', [fifo]);

        expect(() => readRunFile(runDir, fifo, 'not regular')).toThrow(
          'not regular'
        );
      }
    );

    it('refuses to read through a folder planted as a symlink', () => {
      writeFileSync(join(outside, 'file.json'), 'outside');
      symlinkSync(outside, join(runDir, 'sub'));

      expect(() =>
        readRunFile(runDir, join(runDir, 'sub', 'file.json'))
      ).toThrow(`Remove 'sub' from the migrate run and try again`);
    });
  });

  it('treats a folder planted as a symlink as holding nothing to find', () => {
    writeFileSync(join(outside, 'file.json'), 'outside');
    symlinkSync(outside, join(runDir, 'sub'));

    expect(runFileExists(runDir, join(runDir, 'sub', 'file.json'))).toBe(false);
  });

  it('rejects a path outside the run folder', () => {
    expect(() => writeRunFile(runDir, join(outside, 'file.json'), 'x')).toThrow(
      'is not inside the migrate run'
    );
  });

  it.skipIf(process.platform === 'win32')(
    'refuses a lock path planted as a FIFO',
    () => {
      const fifo = join(runDir, 'x.lock');
      execFileSync('mkfifo', [fifo]);

      expect(() => lockRunFile(runDir, fifo)).toThrow(
        `${fifo} is not a regular file.`
      );
    }
  );

  it('removes a symlink itself, not its target', () => {
    const target = join(outside, 'target.json');
    writeFileSync(target, 'kept');
    const link = join(runDir, 'link.json');
    symlinkSync(target, link);

    removeRunFile(runDir, link);

    expect(existsSync(link)).toBe(false);
    expect(readFileSync(target, 'utf-8')).toBe('kept');
  });
});
