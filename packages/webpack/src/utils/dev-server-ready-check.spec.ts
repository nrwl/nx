import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { createServer, Server, type AddressInfo } from 'net';
import { tmpdir, type NetworkInterfaceInfo } from 'os';
import { dirname, join } from 'path';
import {
  getDevServerAddress,
  parseServeArgv,
  parseServeFlags,
  waitForWebpackDevServer,
} from './dev-server-ready-check';

const machine = vi.hoisted(() => ({
  interfaces: {} as Record<string, Partial<NetworkInterfaceInfo>[]>,
}));
vi.mock('os', async () => ({
  ...(await vi.importActual('os')),
  networkInterfaces: () => machine.interfaces,
}));

const noFlags = {
  configNames: [],
  configs: [],
  merge: false,
  env: {},
  extends: [],
};

describe('parseServeFlags', () => {
  const parse = (options: Record<string, unknown>) =>
    parseServeFlags(parseServeArgv(options));

  it('reads the port, host and config names from options and args', () => {
    expect(
      parse({
        args: ['--port', '4300', '--host=0.0.0.0', '--config-name', 'client'],
      })
    ).toEqual({
      ...noFlags,
      port: 4300,
      host: '0.0.0.0',
      configNames: ['client'],
    });
    expect(parse({ args: '--port=4301 --hot' })).toEqual({
      ...noFlags,
      port: 4301,
    });
    expect(parse({ args: `--config "a b.js" --port='4302'` })).toEqual({
      ...noFlags,
      configs: ['a b.js'],
      port: 4302,
    });
  });

  it('takes the next arg as the value of a flag that needs one, as webpack-cli does', () => {
    expect(parse({ args: ['--host', '--hot'] })).toEqual({
      ...noFlags,
      host: '--hot',
    });
  });

  it('stops at a `--` after an option, and drops one before any, as webpack-cli does', () => {
    expect(parse({ args: ['--hot', '--', '--port', '4300'] })).toEqual(noFlags);
    expect(parse({ args: ['--', '--port', '4300'] })).toEqual({
      ...noFlags,
      port: 4300,
    });
  });

  it('reads --config, --merge and --extends in their long and short forms', () => {
    expect(
      parse({
        args: [
          ...['--config', 'a.js', 'b.js', '-c', 'c.js', '--config=d.js'],
          ...['-m', 'entry.js', '--extends', 'base.js', '-e', 'other.js'],
        ],
      })
    ).toMatchObject({
      configs: ['a.js', 'b.js', 'c.js', 'd.js'],
      merge: true,
      extends: ['base.js', 'other.js'],
    });
  });

  it('parses --env the way webpack-cli does', () => {
    expect(
      parse({
        args: ['--env', 'flag', 'app.url=a=b', '--env=unset=', '--env', 'n=1'],
      }).env
    ).toStrictEqual({
      flag: true,
      app: { url: 'a=b' },
      unset: undefined,
      n: '1',
    });
  });
});

describe('getDevServerAddress', () => {
  const flags = noFlags;

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

describe('waitForWebpackDevServer', () => {
  let dir: string;
  let servers: Server[];
  const cwd = process.cwd();

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nx-webpack-ready-'));
    servers = [];
    // The check parses args and merges configs with the workspace's webpack-cli
    mkdirSync(join(dir, 'node_modules'));
    symlinkSync(
      dirname(require.resolve('webpack-cli/package.json')),
      join(dir, 'node_modules', 'webpack-cli'),
      'junction'
    );
  });

  afterEach(async () => {
    process.chdir(cwd);
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
    await Promise.all(servers.map(close));
  });

  function listen(port: number, host = '127.0.0.1') {
    const server = createServer();
    return new Promise<Server>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => resolve(server));
    });
  }

  const close = (server: Server) => new Promise((r) => server.close(r));

  async function getFreePort(): Promise<number> {
    const v4 = await listen(0);
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

  function write(files: Record<string, string>) {
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(dir, name), content);
    }
  }

  // The wait must hold until each port opens in turn, then resolve
  async function expectToWaitFor(wait: Promise<void>, ports: number[]) {
    const settled = (ms: number) =>
      Promise.race([
        wait.then(() => 'resolved'),
        new Promise((r) => setTimeout(r, ms, 'pending')),
      ]);
    for (const port of ports) {
      expect(await settled(500)).toBe('pending');
      servers.push(await listen(port));
    }
    expect(await settled(2000)).toBe('resolved');
  }

  function waitWithOptions(options: Record<string, unknown>) {
    vi.stubEnv('NX_TASK_OPTIONS', JSON.stringify({ cwd: dir, ...options }));
    return waitForWebpackDevServer('webpack.config.js');
  }

  it('reads the port the config computes from the task env in serve mode', async () => {
    const port = await getFreePort();
    write({
      'webpack.config.js': `module.exports = (env) => ({ devServer: { port: env.WEBPACK_SERVE ? Number(process.env.APP_PORT) : 1 } });`,
    });
    vi.stubEnv('APP_PORT', String(port));

    await expectToWaitFor(waitWithOptions({}), [port]);
  });

  it('follows --port in the args of the target', async () => {
    const port = await getFreePort();
    write({
      'webpack.config.js': `module.exports = { devServer: { port: 1 } };`,
    });

    await expectToWaitFor(waitWithOptions({ args: [`--port=${port}`] }), [
      port,
    ]);
  });

  // An .mjs config loads through import(), which has no callback in the vm
  it.each([
    ['an ESM config', '{ "type": "module" }', 'export default'],
    ['a CJS config with exports.default', '{}', 'exports.default ='],
  ])(
    'reads the default export of %s',
    async (_, packageJson, exportDefault) => {
      const port = await getFreePort();
      write({
        'package.json': packageJson,
        'webpack.config.js': `${exportDefault} { devServer: { port: ${port} } };`,
      });

      await expectToWaitFor(waitWithOptions({}), [port]);
    }
  );

  it('unwraps a default export that has its own default, as webpack-cli does', async () => {
    const port = await getFreePort();
    write({
      'package.json': '{ "type": "module" }',
      'webpack.config.js': `export default { default: { devServer: { port: ${port} } } };`,
    });

    await expectToWaitFor(waitWithOptions({}), [port]);
  });

  it('waits for the dev server of every config given with --config', async () => {
    const [first, second] = [await getFreePort(), await getFreePort()];
    write({
      'webpack.config.js': `module.exports = { devServer: { port: 1 } };`,
      'a.js': `module.exports = { devServer: { port: ${first} } };`,
      'b.js': `module.exports = { devServer: { port: ${second} } };`,
    });

    await expectToWaitFor(
      waitWithOptions({ config: 'b.js', args: ['-c', 'a.js'] }),
      [first, second]
    );
  });

  it('merges the configs with --merge, later configs winning', async () => {
    const port = await getFreePort();
    write({
      'webpack.config.js': `module.exports = { devServer: { port: 1 } };`,
      'a.js': `module.exports = { devServer: { port: 1 } };`,
      'b.js': `module.exports = { devServer: { port: ${port} } };`,
    });

    await expectToWaitFor(
      waitWithOptions({ args: ['--config', 'a.js', 'b.js', '--merge'] }),
      [port]
    );
  });

  it('passes --env to a function config', async () => {
    const port = await getFreePort();
    write({
      'webpack.config.js': `module.exports = (env) => ({ devServer: { port: Number(env.app?.port ?? 1) } });`,
    });

    await expectToWaitFor(
      waitWithOptions({ args: ['--env', `app.port=${port}`] }),
      [port]
    );
  });

  it.each([
    [{ args: ['--mode', 'production'] }, 'mode', 'production'],
    [{ mode: 'production' }, 'mode', 'production'],
    [{ args: ['--entry', 'a', 'b', '--entry', 'c'] }, 'entry', ['a', 'b', 'c']],
    [{ args: ['--client-reconnect', '3'] }, 'clientReconnect', 3],
    [{ args: ['--compress', 'src/main.js'] }, 'compress', true],
    [{ args: ['-d', 'eval'] }, 'devtool', 'eval'],
  ])(
    'passes the CLI options of %j to a function config as argv.%s',
    async (options, name, value) => {
      const port = await getFreePort();
      write({
        'webpack.config.js': `module.exports = (env, argv) => ({ devServer: { port: require('util').isDeepStrictEqual(argv.${name}, ${JSON.stringify(value)}) ? ${port} : 1 } });`,
      });

      await expectToWaitFor(waitWithOptions(options), [port]);
    }
  );

  // The extended config's ipc: true would skip the wait unless the extending
  // config's ipc: false wins
  it.each([
    ['in the config', [], 'base.js'],
    [
      'with --extends over the one in the config',
      ['--extends', 'cli-base.js'],
      'cli-base.js',
    ],
  ])('merges the config extended %s under it', async (_, args, extended) => {
    const port = await getFreePort();
    write({
      'webpack.config.js': `module.exports = { extends: './base.js', devServer: { ipc: false } };`,
      'base.js': `module.exports = { devServer: { port: 1 } };`,
      [extended]: `module.exports = { devServer: { port: ${port}, ipc: true } };`,
    });

    await expectToWaitFor(waitWithOptions({ args }), [port]);
  });
});
