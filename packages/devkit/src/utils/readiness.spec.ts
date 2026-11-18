import {
  getForwardedArgs,
  getListeningUrl,
  getReadyCheckReadyWhen,
  parseCommanderArgs,
} from './readiness';

describe('getForwardedArgs', () => {
  it.each([
    [
      'named options, not the run-commands ones',
      {
        command: 'vite',
        cwd: 'apps/a',
        env: { A: '1' },
        port: 4300,
        open: true,
      },
      ['--port=4300', '--open=true'],
    ],
    [
      'args over a named option',
      { port: 3001, args: '--port 3000' },
      ['--port', '3000'],
    ],
    [
      'a kebab-case arg over its camel-case named option',
      { configName: 'a', args: ['--config-name', 'b'] },
      ['--config-name', 'b'],
    ],
    [
      'overrides last',
      { port: 3001, args: '--port 3000', __unparsed__: ['--port=3002'] },
      ['--port', '3000', '--port=3002'],
    ],
    [
      'an override without the named option it replaces',
      { port: 4200, __unparsed__: ['--port=4300'] },
      ['--port=4300'],
    ],
    [
      'overrides without the run-commands options',
      { __unparsed__: ['--cwd', 'apps/b', '--env.FOO=bar', '--host'] },
      ['--host'],
    ],
    [
      'without an --env override, which run-commands keeps for itself',
      { __unparsed__: ['--config', 'a.js', '--env', 'b=2'] },
      ['--config', 'a.js'],
    ],
    [
      'the values of a repeated run-commands option',
      { __unparsed__: ['--cwd', '.', '--cwd', '..'] },
      ['.', '..'],
    ],
    [
      'a named option that args set to the same value',
      { port: 3000, args: '--port 3000' },
      ['--port=3000', '--port', '3000'],
    ],
    [
      'a camel-case named option with its kebab-case override',
      { configName: 'a', __unparsed__: ['--config-name', 'c'] },
      ['--configName=a', '--config-name', 'c'],
    ],
    [
      'args split the way the shell splits them',
      { args: `--config "a b.js" --mode='x'` },
      ['--config', 'a b.js', '--mode=x'],
    ],
    [
      'each override as one argument, which run-commands quotes',
      {
        args: '--config-name "client app"',
        __unparsed__: ['--config-name', 'server app'],
      },
      ['--config-name', 'client app', '--config-name', 'server app'],
    ],
    ['nothing without forwardAllArgs', { port: 1, forwardAllArgs: false }, []],
    [
      'nothing without the forwardAllArgs of the only command',
      { commands: [{ command: 'vite', forwardAllArgs: false }], port: 1 },
      [],
    ],
    [
      'named options through the shell, which removes their quotes',
      { port: `'4300'` },
      ['--port=4300'],
    ],
    [
      'overrides before args into {args}',
      {
        command: 'vite {args}',
        args: '--port 3000',
        __unparsed__: ['--port=3002'],
      },
      ['--port=3002', '--port', '3000'],
    ],
  ])('forwards %s', (_, options, expected) => {
    expect(getForwardedArgs(options)).toEqual(expected);
  });
});

describe('getReadyCheckReadyWhen', () => {
  it('passes the config file name to the check', () => {
    expect(
      getReadyCheckReadyWhen('@nx/vite/ready-check', 'vite.config.ts', 'serve')
        .command
    ).toBe(
      `node -e "require('@nx/vite/ready-check').waitForDevServer(process.argv[1], 'serve')" vite.config.ts`
    );
  });

  it('rejects a config file name the shell would expand', () => {
    expect(() =>
      getReadyCheckReadyWhen('@nx/vite/ready-check', 'vite.$HOME.ts')
    ).toThrow('Unsupported config file name: vite.$HOME.ts');
  });
});

describe('getListeningUrl', () => {
  it('maps a wildcard to localhost and brackets IPv6', () => {
    expect(
      getListeningUrl({ address: '::', family: 'IPv6', port: 1 }, false)
    ).toBe('http://localhost:1/');
    expect(
      getListeningUrl({ address: '0.0.0.0', family: 'IPv4', port: 1 }, true)
    ).toBe('https://localhost:1/');
    expect(
      getListeningUrl({ address: '::1', family: 'IPv6', port: 1 }, false)
    ).toBe('http://[::1]:1/');
    expect(getListeningUrl('/tmp/socket', false)).toBeUndefined();
  });
});

describe('parseCommanderArgs', () => {
  const declarations = [
    '-c --config <config>',
    '-o --open [url]',
    '-w --watch',
    '--env-mode <mode>',
  ];

  it.each([
    [
      'a required value from the next argument, an option included',
      ['--config', '--watch'],
      { config: '--watch' },
    ],
    ['an optional value from the next argument', ['-o', 'x'], { open: 'x' }],
    [
      'no optional value from an option',
      ['--open', '--watch'],
      { open: true, watch: true },
    ],
    [
      'a value after an equals sign',
      ['--config=a.ts', '--open='],
      { config: 'a.ts', open: '' },
    ],
    [
      'short flags with the rest of the argument',
      ['-c=a.ts', '-wox'],
      { config: '=a.ts', watch: true, open: 'x' },
    ],
    ['the last value', ['--config', 'a.ts', '-c', 'b.ts'], { config: 'b.ts' }],
    [
      'options up to --, around operands',
      ['serve', '-', '--env-mode', 'x', '--', '--config', 'a.ts'],
      { envMode: 'x' },
    ],
  ])('parses %s', (_, args, expected) => {
    expect(parseCommanderArgs(args, declarations)).toEqual(expected);
  });

  it.each([
    [['--help'], "unknown option '--help'"],
    [['--watch=true'], "unknown option '--watch=true'"],
    [['--env-mode'], "option '--env-mode <mode>' argument missing"],
  ])('throws on %j, where commander exits', (args, message) => {
    expect(() => parseCommanderArgs(args, declarations)).toThrow(message);
  });
});
