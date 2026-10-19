import { TempFs } from '@nx/devkit/internal-testing-utils';
import { symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { getShebangLine, parseShebang, readScriptHeader } from './shebang';

describe('readScriptHeader', () => {
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('shebang');
  });

  afterEach(() => tempFs.cleanup());

  const read = (content: string) => {
    tempFs.createFileSync('script.js', content);
    return readScriptHeader(join(tempFs.tempDir, 'script.js'));
  };

  it.each([
    ['#!/usr/bin/env node\nconsole.log(1);', '/usr/bin/env node'],
    ['#!/usr/bin/env node\r\nconsole.log(1);', '/usr/bin/env node'],
    ['\uFEFF#!/usr/bin/env node\n', '/usr/bin/env node'],
    ['#!/usr/local/bin/node', '/usr/local/bin/node'],
  ])('%j has shebang %j', (content, expected) => {
    expect(getShebangLine(read(content))).toBe(expected);
  });

  it.each([['console.log("#!/usr/bin/env node");'], ['']])(
    '%j has no header',
    (content) => {
      expect(read(content)).toBeNull();
    }
  );

  it('should drop the line the sniff cuts off', () => {
    const header = read(`#!/usr/bin/env node\n// ${'x'.repeat(600)}\n`);

    expect(header).toBe('#!/usr/bin/env node');
  });

  it('should return null for a broken symlink', () => {
    symlinkSync(
      join(tempFs.tempDir, 'missing.js'),
      join(tempFs.tempDir, 'link.js')
    );

    expect(readScriptHeader(join(tempFs.tempDir, 'link.js'))).toBeNull();
  });
});

describe('parseShebang', () => {
  it.each([
    ['/usr/bin/env node', { interpreter: 'node', args: [] }],
    [
      '/usr/bin/env -S node --enable-source-maps',
      { interpreter: 'node', args: ['--enable-source-maps'] },
    ],
    ['/usr/bin/env -S npx tsx', { interpreter: 'tsx', args: [] }],
    ['/usr/local/bin/node', { interpreter: 'node', args: [] }],
    ['/bin/bash', { interpreter: 'bash', args: [] }],
    ['/usr/bin/env', null],
    ['', null],
  ])('%j', (line, expected) => {
    expect(parseShebang(line)).toEqual(expected);
  });
});
