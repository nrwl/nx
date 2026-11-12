import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readCallTrace } from './evaluation-cache';

describe('readCallTrace', () => {
  let dir: string;
  let logPath: string;
  const workerScript = resolve('/ws/node_modules/nx/plugin-worker.js');
  const markers = () => ({ logPath, workerScript });
  const write = (...lines: string[]) =>
    writeFileSync(logPath, lines.map((l) => l + '\n').join(''));

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'read-call-trace-'));
    logPath = join(dir, 'worker.log');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('should attribute the load phase and the call to the call', () => {
    write(
      workerScript,
      '/ws/tools/plugin.js',
      '!begin a',
      '/ws/libs/a/config.js',
      '!end a'
    );
    expect(readCallTrace(markers(), 'a')?.sort()).toEqual(
      [workerScript, '/ws/libs/a/config.js', '/ws/tools/plugin.js']
        .map((p) => resolve(p))
        .sort()
    );
  });

  it('should leave out reads that belong to other calls', () => {
    write(
      workerScript,
      '!begin a',
      '/ws/a.js',
      '!end a',
      '/ws/between.js',
      '!begin b',
      '/ws/b.js',
      '!end b'
    );
    expect(readCallTrace(markers(), 'b')).not.toContain(resolve('/ws/a.js'));
    expect(readCallTrace(markers(), 'b')).not.toContain(
      resolve('/ws/between.js')
    );
    expect(readCallTrace(markers(), 'b')).toContain(resolve('/ws/b.js'));
  });

  // Overlapping calls only add reads, which can cause an extra run but never a
  // stale result.
  it('should keep reads of a call that overlaps this one', () => {
    write(workerScript, '!begin a', '!begin b', '/ws/b.js', '!end b', '!end a');
    expect(readCallTrace(markers(), 'a')).toContain(resolve('/ws/b.js'));
  });

  it('should distrust a trace that never saw the worker start', () => {
    write('!begin a', '/ws/a.js', '!end a');
    expect(readCallTrace(markers(), 'a')).toBeNull();
  });

  it('should distrust a trace with an untraced child', () => {
    write(workerScript, '!begin a', '!untraced /usr/bin/sudo', '!end a');
    expect(readCallTrace(markers(), 'a')).toBeNull();
  });

  it('should distrust a call that has not finished', () => {
    write(workerScript, '!begin a', '/ws/a.js');
    expect(readCallTrace(markers(), 'a')).toBeNull();
  });

  it('should distrust a missing log', () => {
    expect(readCallTrace(markers(), 'a')).toBeNull();
  });
});
