import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer, Server, type AddressInfo } from 'net';
import { tmpdir, type NetworkInterfaceInfo } from 'os';
import { dirname, join } from 'path';
import {
  getDevServerAddress,
  parseServeFlags,
  waitForRspackDevServer,
} from './dev-server-ready-check';

const machine = vi.hoisted(() => ({
  interfaces: {} as Record<string, Partial<NetworkInterfaceInfo>[]>,
}));
vi.mock('os', async () => ({
  ...(await vi.importActual('os')),
  networkInterfaces: () => machine.interfaces,
}));

describe('parseServeFlags', () => {
  it('reads the port, host and config names from options and args', () => {
    expect(
      parseServeFlags(
        {
          args: ['--port', '4300', '--host=0.0.0.0', '--config-name', 'client'],
        },
        null
      )
    ).toMatchObject({ port: 4300, host: '0.0.0.0', configNames: ['client'] });
    expect(
      parseServeFlags({ args: `--config "a b.js" --port='4302'` }, null)
    ).toMatchObject({ port: 4302, config: 'a b.js' });
  });

  const env = { RSPACK_SERVE: true };
  const yargsDefaults = { _: ['serve'], $0: 'rspack', env };
  // The argv parseServeFlags builds for each @rspack/cli version. The 1.0 to
  // 1.5 rows parse with this repo's yargs and that version's option table
  it.each([
    [
      '2.2.7',
      ['--config-name', 'a', '--configName', 'b'],
      { '--': [], configLoader: 'auto', configName: ['b'], env },
    ],
    [
      '2.2.7',
      ['-c', 'a.js', '--config', 'b.js'],
      { '--': [], configLoader: 'auto', c: 'a.js', config: 'a.js', env },
    ],
    [
      '2.2.7',
      ['--devtool', 'false', '--hot', 'false', '--watch', 'false'],
      {
        '--': [],
        configLoader: 'auto',
        d: 'false',
        devtool: false,
        hot: false,
        w: false,
        watch: false,
        env,
      },
    ],
    [
      '1.7.12',
      ['--port', '4200'],
      { '--': [], configLoader: 'register', port: 4200, env },
    ],
    [
      '1.5.8',
      ['-m', 'production', '--mode', 'development', '--port', 'abc'],
      {
        ...yargsDefaults,
        configLoader: 'register',
        'config-loader': 'register',
        m: ['production', 'development'],
        mode: ['production', 'development'],
        w: false,
        watch: false,
      },
    ],
    [
      '1.5.8',
      ['--devtool', 'true', '--hot', 'only', '-w'],
      {
        ...yargsDefaults,
        configLoader: 'register',
        'config-loader': 'register',
        d: 'source-map',
        devtool: 'source-map',
        hot: 'only',
        w: true,
        watch: true,
      },
    ],
    [
      '1.0.14',
      ['--devtool', 'true', '--hot', 'only', '-w'],
      {
        ...yargsDefaults,
        d: true,
        devtool: true,
        hot: 'only',
        w: true,
        watch: true,
      },
    ],
  ])('passes the argv @rspack/cli %s does for %j', (version, args, argv) => {
    const { argv: parsed } = parseServeFlags(
      { args },
      // Resolves the yargs this repo installs
      { version, dir: __dirname }
    );
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(argv);
  });

  it.each([
    [{ config: 'a.js', args: ['-c', 'b.js'] }, { config: 'a.js' }],
    [{ nodeEnv: 'production' }, { nodeEnv: 'production' }],
    [
      {
        configName: 'a',
        args: ['--config-name', 'b'],
        __unparsed__: ['--config-name', 'c'],
      },
      { configNames: ['b', 'c'] },
    ],
    [
      { configName: 'a', __unparsed__: ['--config-name', 'c'] },
      { configNames: ['c'] },
    ],
  ])('reads the flags of %j as @rspack/cli does', (options, flags) => {
    expect(parseServeFlags(options, null)).toMatchObject(flags);
  });
});

describe('getDevServerAddress', () => {
  const flags = { configNames: [], env: {}, argv: {} };

  it('takes the flag, then devServer.port, then the base port, then 8080', () => {
    expect(
      getDevServerAddress({ port: 4200 }, { ...flags, port: '4300' }, undefined)
    ).toEqual({ port: 4300 });
    expect(getDevServerAddress({ port: 4200 }, flags, '9000')).toEqual({
      port: 4200,
    });
    expect(getDevServerAddress({}, flags, '9000')).toEqual({ port: 9000 });
    expect(getDevServerAddress(undefined, flags, undefined)).toEqual({
      port: 8080,
    });
  });

  it('has no address when the server picks its port or listens on a socket', () => {
    expect(getDevServerAddress({ port: 'auto' }, flags, undefined)).toBeNull();
    expect(getDevServerAddress({ port: 0 }, flags, undefined)).toBeNull();
    expect(getDevServerAddress({ ipc: true }, flags, undefined)).toBeNull();
  });

  it('resolves local-ip hosts to an interface address, as the dev server does', () => {
    machine.interfaces = {
      en0: [{ address: '192.168.1.5', family: 'IPv4', internal: false }],
    };
    expect(
      getDevServerAddress({ port: 1, host: 'local-ipv4' }, flags, undefined)
    ).toEqual({ port: 1, host: '192.168.1.5' });
    machine.interfaces = {};
    expect(
      getDevServerAddress({ port: 1, host: 'local-ipv4' }, flags, undefined)
    ).toEqual({ port: 1 });
  });

  it('probes loopback for wildcard hosts and the named host otherwise', () => {
    expect(
      getDevServerAddress({ port: 1, host: '0.0.0.0' }, flags, undefined)
    ).toEqual({ port: 1 });
    expect(
      getDevServerAddress({ port: 1, host: 'dev.local' }, flags, undefined)
    ).toEqual({ port: 1, host: 'dev.local' });
  });
});

describe('waitForRspackDevServer', () => {
  let dir: string;
  let port: number;
  let otherPort: number;
  let listeners: Server[];
  const cwd = process.cwd();
  const pending = Symbol('pending');

  const write = (path: string, content: string) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  };
  const writePackage = (path: string, name: string, version: string) =>
    write(`${path}/package.json`, JSON.stringify({ name, version }));
  const stubTaskOptions = (options: Record<string, unknown>) =>
    vi.stubEnv('NX_TASK_OPTIONS', JSON.stringify({ cwd: dir, ...options }));
  const settle = (wait: Promise<void>, ms: number) =>
    Promise.race([wait, new Promise((r) => setTimeout(r, ms, pending))]);

  // Fails on a check that resolves before the dev server listens
  async function expectToWaitForPort(wait: Promise<void>) {
    expect(await settle(wait, 500)).toBe(pending);
    listeners.push(await listen(port, '127.0.0.1'));
    expect(await settle(wait, 2000)).toBeUndefined();
  }

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'nx-rspack-ready-'));
    listeners = [];
    port = await getFreePort();
    do otherPort = await getFreePort();
    while (otherPort === port);
    // The check sets these, so stubbing them restores them afterwards
    vi.stubEnv('NODE_ENV', process.env.NODE_ENV);
    vi.stubEnv('RSPACK_SERVE', undefined);
    vi.stubEnv('WEBPACK_SERVE', undefined);
  });

  afterEach(async () => {
    process.chdir(cwd);
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
    await Promise.all(listeners.map(close));
  });

  it('reads the port the config computes from the task env in serve mode', async () => {
    write(
      'rspack.config.js',
      `module.exports = (env) => ({ devServer: { port: env.RSPACK_SERVE ? Number(process.env.APP_PORT) : ${otherPort} } });`
    );
    vi.stubEnv('APP_PORT', String(port));
    stubTaskOptions({});

    await expectToWaitForPort(waitForRspackDevServer('rspack.config.js'));
  });

  it('starts one dev server, for the first config with devServer', async () => {
    write(
      'rspack.config.js',
      `module.exports = [{ name: 'a' }, { name: 'b', devServer: { port: ${port} } }, { name: 'c', devServer: { port: ${otherPort} } }];`
    );
    stubTaskOptions({});

    await expectToWaitForPort(waitForRspackDevServer('rspack.config.js'));
  });

  it('serves a devServer: false config on the default port, as rspack serve does', async () => {
    write('rspack.config.js', `module.exports = { devServer: false };`);
    vi.stubEnv('RSPACK_DEV_SERVER_BASE_PORT', String(port));
    stubTaskOptions({});

    await expectToWaitForPort(waitForRspackDevServer('rspack.config.js'));
  });

  it('follows --port in the args of the target', async () => {
    write(
      'rspack.config.js',
      `module.exports = { devServer: { port: ${otherPort} } };`
    );
    stubTaskOptions({ args: [`--port=${port}`] });

    await expectToWaitForPort(waitForRspackDevServer('rspack.config.js'));
  });

  it.each([
    ['nested 1.x under @rspack/cli', 'WEBPACK', 'RSPACK'],
    ['hoisted 2.x', 'RSPACK', 'WEBPACK'],
  ])(
    'follows the env of the dev server @rspack/cli loads (%s)',
    async (_, prefix, otherPrefix) => {
      writePackage('node_modules/@rspack/cli', '@rspack/cli', '1.7.12');
      writePackage(
        'node_modules/@rspack/dev-server',
        '@rspack/dev-server',
        '2.0.3'
      );
      if (prefix === 'WEBPACK') {
        writePackage(
          'node_modules/@rspack/cli/node_modules/@rspack/dev-server',
          '@rspack/dev-server',
          '1.2.1'
        );
      }
      write(
        'rspack.config.js',
        `module.exports = { devServer: process.env.${prefix}_SERVE === 'true' ? {} : { port: ${otherPort} } };`
      );
      vi.stubEnv(`${prefix}_DEV_SERVER_BASE_PORT`, String(port));
      vi.stubEnv(`${otherPrefix}_DEV_SERVER_BASE_PORT`, String(otherPort));
      stubTaskOptions({});

      await expectToWaitForPort(waitForRspackDevServer('rspack.config.js'));
    }
  );

  it.each([
    [{ args: ['--config', 'other.config.js'] }],
    [{ args: ['-c', 'other.config.js'] }],
    [{ config: 'other.config.js' }],
  ])('loads the config given by --config instead (%j)', async (options) => {
    write(
      'rspack.config.js',
      `module.exports = { devServer: { port: ${otherPort} } };`
    );
    write(
      'other.config.js',
      `module.exports = { devServer: { port: ${port} } };`
    );
    stubTaskOptions(options);

    await expectToWaitForPort(waitForRspackDevServer('rspack.config.js'));
  });

  it('passes the parsed CLI options to a function config as argv', async () => {
    write(
      'rspack.config.js',
      `module.exports = (env, argv) => ({ devServer: { port: argv.mode === 'production' ? ${port} : ${otherPort} } });`
    );
    stubTaskOptions({ args: ['--mode', 'production'] });

    await expectToWaitForPort(waitForRspackDevServer('rspack.config.js'));
  });

  it('passes --env to the config the way @rspack/cli parses it', async () => {
    write(
      'rspack.config.js',
      `module.exports = (env) => ({ devServer: { port: env.a.b === 'x=y' && env.flag === true && env.RSPACK_SERVE === 'user' && !('prototype' in env) ? Number(env.port) : ${otherPort} } });`
    );
    stubTaskOptions({
      args: [
        '--env',
        'a.b=x=y',
        '--env=flag',
        '--env',
        'RSPACK_SERVE=user',
        '--env',
        'prototype=1',
        `--env=port=${port}`,
      ],
    });

    await expectToWaitForPort(waitForRspackDevServer('rspack.config.js'));
  });

  it.each([
    [
      'a path relative to the config',
      `{ extends: './base', devServer: { hot: true } }`,
      'app/base.js',
      `(env) => ({ devServer: { port: env.RSPACK_SERVE ? APP_PORT : OTHER_PORT } })`,
      [],
    ],
    [
      'a package, overridden by the extending config',
      `{ extends: 'base-config', devServer: { port: APP_PORT } }`,
      'node_modules/base-config/index.js',
      `{ name: 'app', devServer: { port: OTHER_PORT } }`,
      ['--config-name', 'app'],
    ],
  ])(
    'merges in the config it extends from %s',
    async (_, config, basePath, base, args) => {
      const header = `const { APP_PORT, OTHER_PORT } = process.env;\n`;
      write('app/rspack.config.js', `${header}module.exports = ${config};`);
      write(basePath, `${header}module.exports = ${base};`);
      vi.stubEnv('APP_PORT', String(port));
      vi.stubEnv('OTHER_PORT', String(otherPort));
      stubTaskOptions({ args });

      await expectToWaitForPort(waitForRspackDevServer('app/rspack.config.js'));
    }
  );

  it.each([
    [[], 'development'],
    [['--node-env', 'production'], 'production'],
  ])(
    'sets an unset NODE_ENV as rspack serve does (%j)',
    async (args, nodeEnv) => {
      vi.stubEnv('NODE_ENV', undefined);
      write(
        'rspack.config.js',
        `module.exports = { devServer: { port: process.env.NODE_ENV === '${nodeEnv}' ? ${port} : ${otherPort} } };`
      );
      stubTaskOptions({ args });

      await expectToWaitForPort(waitForRspackDevServer('rspack.config.js'));
    }
  );
});

function listen(port: number, host: string): Promise<Server> {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once('error', reject).listen(port, host, () => resolve(server));
  });
}

function close(server: Server) {
  return new Promise((r) => server.close(r));
}

async function getFreePort(): Promise<number> {
  const v4 = await listen(0, '127.0.0.1');
  const { port } = v4.address() as AddressInfo;
  // The wait also probes ::1, where a port free on 127.0.0.1 can be taken
  const v6 = await listen(port, '::1').catch((e: NodeJS.ErrnoException) => e);
  await close(v4);
  if (v6 instanceof Server) {
    await close(v6);
  } else if (v6.code === 'EADDRINUSE') {
    return getFreePort();
  }
  return port;
}
