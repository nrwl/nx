import { getShebangLine, parseShebang } from './shebang';

describe('getShebangLine', () => {
  it.each([
    ['#!/usr/bin/env node\nconsole.log(1);', '/usr/bin/env node'],
    ['#!/usr/bin/env node\r\nconsole.log(1);', '/usr/bin/env node'],
    ['#!/usr/local/bin/node', '/usr/local/bin/node'],
  ])('%j has shebang %j', (header, expected) => {
    expect(getShebangLine(header)).toBe(expected);
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
