import { TaskDetails, NxCache, getFilesForOutputsBatch } from '../index';
import { join } from 'path';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import { rmSync, statSync, symlinkSync } from 'fs';
import { getDbConnection } from '../../utils/db-connection';
import { randomBytes } from 'crypto';

describe('Cache', () => {
  let cache: NxCache;
  let tempFs: TempFs;
  let taskDetails: TaskDetails;

  const dbOutputFolder = 'temp-db-cache';
  beforeEach(() => {
    tempFs = new TempFs('cache');

    const dbConnection = getDbConnection({
      directory: join(__dirname, dbOutputFolder),
      dbName: `temp-db-${randomBytes(4).toString('hex')}`,
    });
    taskDetails = new TaskDetails(dbConnection);

    cache = new NxCache(
      tempFs.tempDir,
      join(tempFs.tempDir, '.cache'),
      dbConnection
    );

    taskDetails.recordTaskDetails([
      {
        hash: '123',
        project: 'proj',
        target: 'test',
        configuration: 'production',
      },
    ]);
  });

  afterAll(() => {
    rmSync(join(__dirname, dbOutputFolder), {
      recursive: true,
      force: true,
    });
  });

  it('should store results into cache', async () => {
    const result = cache.get('123');

    expect(result).toBeNull();

    tempFs.createFileSync('dist/output.txt', 'output contents 123');

    cache.put('123', 'output 123', ['dist'], 0);

    tempFs.removeFileSync('dist/output.txt');

    const result2 = cache.get('123');
    cache.copyFilesFromCache(result2, ['dist']);

    expect(result2.code).toEqual(0);
    expect(result2.terminalOutput).toEqual('output 123');

    expect(await tempFs.readFile('dist/output.txt')).toEqual(
      'output contents 123'
    );
  });

  it('should return the files it copies, stamped as they are in the workspace', () => {
    tempFs.createFileSync('dist/output.txt', 'output contents 123');
    const stampOf = (path: string) => {
      const { mtimeNs, size } = statSync(join(tempFs.tempDir, path), {
        bigint: true,
      });
      return `${mtimeNs}:${size}`;
    };

    const stored = cache.put('123', 'output 123', ['dist'], 0);
    expect(stored.files).toEqual([
      { path: 'dist/output.txt', stamp: stampOf('dist/output.txt') },
    ]);

    tempFs.removeFileSync('dist/output.txt');
    const restored = cache.copyFilesFromCache(cache.get('123'), ['dist']);
    expect(restored).toEqual([
      { path: 'dist/output.txt', stamp: stampOf('dist/output.txt') },
    ]);
  });

  it('should copy exactly the output files getFilesForOutputs defines', () => {
    for (const file of [
      'dist/app/a.js',
      'dist/app/nested/b.js',
      'dist/app/cache/c.bin',
      'dist/app/node_modules/dep/d.js',
      'dist/app/e.map',
    ]) {
      tempFs.createFileSync(file, file);
    }
    symlinkSync(
      join(tempFs.tempDir, 'dist/app/a.js'),
      join(tempFs.tempDir, 'dist/app/linked-a.js')
    );
    symlinkSync(
      join(tempFs.tempDir, 'dist/app/nested'),
      join(tempFs.tempDir, 'dist/app/linked-nested')
    );

    for (const outputs of [
      ['dist/app'],
      ['dist/app', '!dist/app/cache'],
      ['dist/app', '!dist/app/cache/**'],
      ['dist/app/**', '!dist/app/cache/**'],
      ['dist/app', '!**/*.map'],
      ['dist/app/**/*.js'],
      ['dist/app/a.js', 'dist/app/linked-a.js', 'dist/app/linked-nested'],
    ]) {
      const copied = cache
        .put('123', 'output 123', outputs, 0)
        .files.map((file) => file.path);
      const [defined] = getFilesForOutputsBatch(tempFs.tempDir, [outputs]);
      expect([...new Set(copied)].sort()).toEqual(defined);
    }
  });

  it('should define the output files of an absolute output as the cache copies them', () => {
    tempFs.createFileSync('dist/app/a.js', 'a');
    tempFs.createFileSync('dist/main.js', 'main');
    for (const outputs of [
      [join(tempFs.tempDir, 'dist/app')],
      [join(tempFs.tempDir, 'dist/main.js')],
    ]) {
      const copied = cache
        .put('123', 'output 123', outputs, 0)
        .files.map((file) => file.path);
      const [defined] = getFilesForOutputsBatch(tempFs.tempDir, [outputs]);
      expect(defined).toEqual(copied);
    }
  });

  it('should return restored files only when they are all the output files', () => {
    tempFs.createFileSync('dist/app/a.js', 'a');
    cache.put('123', 'output 123', ['dist/app', 'dist/other'], 0);

    expect(
      cache.copyFilesFromCache(cache.get('123'), ['dist/app', 'dist/other'])
    ).toEqual([expect.objectContaining({ path: 'dist/app/a.js' })]);
    // A glob restores its matches and leaves other matching files in place.
    expect(cache.copyFilesFromCache(cache.get('123'), ['dist/app/*.js'])).toBe(
      null
    );
    // An output the cache never held keeps whatever the workspace has there.
    tempFs.createFileSync('dist/other/stale.js', 'stale');
    expect(
      cache.copyFilesFromCache(cache.get('123'), ['dist/app', 'dist/other'])
    ).toBe(null);
  });

  it('should return restored links to files the same restore writes', () => {
    tempFs.createFileSync('dist/b/target.js', 'target');
    symlinkSync(
      join(tempFs.tempDir, 'dist/b/target.js'),
      join(tempFs.tempDir, 'dist/link-to-b.js')
    );
    for (let i = 0; i < 40; i++) {
      tempFs.createFileSync(`dist/a/real-${i}.js`, `${i}`);
      symlinkSync(`real-${i}.js`, join(tempFs.tempDir, `dist/a/link-${i}.js`));
    }
    const outputs = ['dist/a', 'dist/link-to-b.js', 'dist/b'];
    cache.put('123', 'output 123', outputs, 0);
    rmSync(join(tempFs.tempDir, 'dist'), { recursive: true, force: true });

    const restored = cache
      .copyFilesFromCache(cache.get('123'), outputs)
      ?.map((file) => file.path);
    const [defined] = getFilesForOutputsBatch(tempFs.tempDir, [outputs]);
    expect([...new Set(restored)].sort()).toEqual(defined);
  });

  it('should handle storing hashes that already exist in the cache', async () => {
    cache.put('123', 'output 123', ['dist'], 0);
    expect(() => cache.put('123', 'output 123', ['dist'], 0)).not.toThrow();
  });

  describe('terminal output records', () => {
    it('should not serve a recorded terminal output as a cache hit', () => {
      // There are no artifacts behind this hash — only a terminal output file
      // that the GC needs to know about. Replaying it would restore nothing
      // while reporting a hit.
      cache.recordTerminalOutputs([{ hash: '123', size: 10 }]);

      expect(cache.get('123')).toBeNull();
    });

    it('should count a recorded terminal output against the cache size', () => {
      cache.recordTerminalOutputs([{ hash: '123', size: 10 }]);

      expect(cache.getCacheSize()).toEqual(10);
    });

    it('should let a real cache entry supersede a recorded terminal output', () => {
      cache.recordTerminalOutputs([{ hash: '123', size: 10 }]);
      tempFs.createFileSync('dist/output.txt', 'output contents 123');

      cache.put('123', 'output 123', ['dist'], 0);

      const result = cache.get('123');
      expect(result).not.toBeNull();
      expect(result.terminalOutput).toEqual('output 123');
    });

    it('should not let a recorded terminal output demote a real cache entry', () => {
      tempFs.createFileSync('dist/output.txt', 'output contents 123');
      cache.put('123', 'output 123', ['dist'], 0);

      // A later --skip-nx-cache run writes the terminal output again; the
      // cache entry it would otherwise clobber is still a valid hit.
      cache.recordTerminalOutputs([{ hash: '123', size: 10 }]);

      const result = cache.get('123');
      expect(result).not.toBeNull();
      expect(result.terminalOutput).toEqual('output 123');
    });

    it('should not resize a real cache entry when its output is rewritten', () => {
      tempFs.createFileSync('dist/output.txt', 'output contents 123');
      cache.put('123', 'output 123', ['dist'], 0);
      const sizeWithArtifacts = cache.getCacheSize();

      // The entry's size covers its artifacts; a bare terminal output rewrite
      // must not replace it with the size of the output alone.
      cache.recordTerminalOutputs([{ hash: '123', size: 1 }]);

      expect(cache.getCacheSize()).toEqual(sizeWithArtifacts);
    });

    it('should ignore an empty batch', () => {
      expect(() => cache.recordTerminalOutputs([])).not.toThrow();
    });
  });
});
