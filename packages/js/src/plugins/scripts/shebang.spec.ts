import { TempFs } from '@nx/devkit/internal-testing-utils';
import { join } from 'node:path';
import { parseShebang, readShebangLine } from './shebang';

describe('readShebangLine', () => {
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('shebang');
  });

  afterEach(() => tempFs.cleanup());

  it.each([
    ['#!/usr/bin/env node\nconsole.log(1);', '/usr/bin/env node'],
    ['#!/usr/bin/env node\r\nconsole.log(1);', '/usr/bin/env node'],
    ['﻿#!/usr/bin/env node\n', '/usr/bin/env node'],
    ['#!/usr/local/bin/node', '/usr/local/bin/node'],
    ['console.log("#!/usr/bin/env node");', null],
    ['', null],
  ])('%j -> %j', (content, expected) => {
    tempFs.createFileSync('script.js', content);
    expect(readShebangLine(join(tempFs.tempDir, 'script.js'))).toBe(expected);
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
