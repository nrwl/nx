import { execFileSync } from 'child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  FileReplacedDuringReadError,
  listRunFolder,
  lockRunFile,
  lstatRunFile,
  readInspectedFile,
  readRunFile,
  removeRunFile,
  runFileExists,
  runSubdirState,
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

  describe('runSubdirState', () => {
    it.each([
      ['a real directory', () => mkdirSync(join(runDir, 'sub')), 'directory'],
      [
        'a symlink to a directory',
        () => symlinkSync(outside, join(runDir, 'sub')),
        'other',
      ],
      ['a file', () => writeFileSync(join(runDir, 'sub'), ''), 'other'],
      ['nothing', () => {}, 'missing'],
    ])('reports %s', (_, plant, expected) => {
      plant();
      expect(runSubdirState(join(runDir, 'sub'))).toBe(expected);
    });
  });

  describe('readInspectedFile', () => {
    it('reports a replacement when the inode changed after the caller lstatted it', () => {
      const path = join(runDir, 'state.json');
      writeFileSync(path, 'first');
      const stat = lstatSync(path, { bigint: true });
      const replacement = join(runDir, 'replacement.json');
      writeFileSync(replacement, 'second');
      renameSync(replacement, path); // same name, new inode

      expect(() => readInspectedFile(path, stat, 'replaced')).toThrow(
        FileReplacedDuringReadError
      );
    });
  });

  describe('readRunFile', () => {
    it('reads a regular file', () => {
      const path = join(runDir, 'state.json');
      writeFileSync(path, 'contents');

      expect(readRunFile(runDir, path)).toBe('contents');
    });

    it('refuses a symlink instead of following it', () => {
      const target = join(outside, 'target.json');
      writeFileSync(target, 'secret');
      const link = join(runDir, 'link.json');
      symlinkSync(target, link);

      expect(() => readRunFile(runDir, link, 'not regular')).toThrow(
        'not regular'
      );
    });

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
  });

  describe('folders between the run folder and the target', () => {
    const file = () => join(runDir, 'sub', 'file.json');

    it.each([
      ['read', () => readRunFile(runDir, file())],
      ['write', () => writeRunFile(runDir, file(), 'x')],
      ['list', () => listRunFolder(runDir, join(runDir, 'sub'))],
      ['lstat', () => lstatRunFile(runDir, file())],
      ['lock', () => lockRunFile(runDir, file())],
    ])('refuses to %s through a folder planted as a symlink', (_, op) => {
      writeFileSync(join(outside, 'file.json'), 'outside');
      symlinkSync(outside, join(runDir, 'sub'));

      expect(op).toThrow(`Remove 'sub' from the migrate run and try again`);
      expect(readdirSync(outside)).toEqual(['file.json']);
      expect(readFileSync(join(outside, 'file.json'), 'utf-8')).toBe('outside');
    });

    it('treats a folder planted as a symlink as holding nothing to remove or find', () => {
      writeFileSync(join(outside, 'file.json'), 'outside');
      symlinkSync(outside, join(runDir, 'sub'));

      removeRunFile(runDir, file());
      expect(runFileExists(runDir, file())).toBe(false);
      expect(existsSync(join(outside, 'file.json'))).toBe(true);
    });

    it('creates missing folders on a write', () => {
      writeRunFile(runDir, join(runDir, 'a', 'b', 'file.json'), 'x');

      expect(readRunFile(runDir, join(runDir, 'a', 'b', 'file.json'))).toBe(
        'x'
      );
    });

    it('rejects a path outside the run folder', () => {
      expect(() =>
        writeRunFile(runDir, join(outside, 'file.json'), 'x')
      ).toThrow('is not inside the migrate run');
    });
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
