import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { createServer as createHttpServer } from 'http';
import { createServer, Server, type AddressInfo } from 'net';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { waitForNuxtDevServer } from './dev-server-ready-check';
import { waitUntilServing } from './wait-until-serving';

// `Function('return import("@nuxt/kit")')` has no dynamic import callback in the vm
vi.mock('./executor-utils', () => ({
  loadNuxtKitDynamicImport: () => import('@nuxt/kit'),
}));
// Real by default, so a test replaces only a wait on a port it can't bind
vi.mock('./wait-until-serving', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./wait-until-serving')>();
  return { waitUntilServing: vi.fn(actual.waitUntilServing) };
});

// A host the check never reaches, for the one `nuxt dev` doesn't listen on
const UNREACHABLE_HOST = 'nx-ready-check.invalid';

describe('waitForNuxtDevServer', () => {
  const cwd = process.cwd();
  const pending = Symbol('pending');
  let dir: string;
  let port: number;
  let otherPort: number;
  let listeners: Server[];

  const write = (path: string, content: string) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  };
  const writeConfig = (path: string, config: string) =>
    write(path, `export default defineNuxtConfig(${config});`);
  const stubTaskOptions = (options: Record<string, unknown>) =>
    vi.stubEnv('NX_TASK_OPTIONS', JSON.stringify({ cwd: dir, ...options }));
  const settle = (wait: Promise<void>, ms: number) =>
    Promise.race([wait, new Promise((r) => setTimeout(r, ms, pending))]);

  // The `name@version` of the CLI the project's nuxt depends on, left
  // uninstalled without a version
  const installCli = (cli: string) => {
    const [, name, version] = /^(.+)@(.*)$/.exec(cli);
    write(
      'node_modules/nuxt/package.json',
      JSON.stringify({ name: 'nuxt', dependencies: { [name]: version || '*' } })
    );
    if (version) {
      write(
        `node_modules/${name}/package.json`,
        JSON.stringify({ name, version })
      );
    }
  };

  async function expectToWaitForServer(wait: Promise<void>) {
    expect(await settle(wait, 300)).toBe(pending);
    listeners.push(await serve(port, () => 404));
    expect(await settle(wait, 2000)).toBeUndefined();
  }

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'nx-nuxt-ready-'));
    listeners = [];
    vi.mocked(waitUntilServing).mockClear();
    port = await getFreePort();
    do otherPort = await getFreePort();
    while (otherPort === port);
    // The check, .env files and the shell can set these, so each test starts
    // without them and restores them afterwards
    vi.stubEnv('NODE_ENV', process.env.NODE_ENV);
    for (const name of [
      '_PORT',
      'NUXT_PORT',
      'NITRO_PORT',
      'PORT',
      'NUXT_HOST',
      'NITRO_HOST',
      'HOST',
    ]) {
      vi.stubEnv(name, undefined);
    }
  });

  afterEach(async () => {
    process.chdir(cwd);
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
    await Promise.all(listeners.map(close));
  });

  interface Setup {
    args?: string[];
    env?: Record<string, string>;
    // null leaves the port out of the config
    configPort?: string | null;
    configHost?: string;
    files?: Record<string, string>;
  }

  function prepare(setup: (p: string, o: string) => Setup) {
    const {
      args = [],
      env = {},
      configPort = String(otherPort),
      configHost,
      files = {},
    } = setup(String(port), String(otherPort));
    const devServer = [
      configPort !== null && `port: ${configPort}`,
      configHost && `host: '${configHost}'`,
    ].filter(Boolean);
    writeConfig('nuxt.config.ts', `{ devServer: { ${devServer.join(', ')} } }`);
    for (const [path, content] of Object.entries(files)) write(path, content);
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    stubTaskOptions({ args });
  }

  // Each row gets the port to wait for, then another one
  it.each<[string, (p: string, o: string) => Setup]>([
    [
      '--port over the env',
      (p, o) => ({ args: ['--port', p], env: { NUXT_PORT: o } }),
    ],
    ['-p over the env', (p, o) => ({ args: ['-p', p], env: { PORT: o } })],
    [
      'NUXT_PORT over NITRO_PORT',
      (p, o) => ({ env: { NUXT_PORT: p, NITRO_PORT: o } }),
    ],
    ['NITRO_PORT over PORT', (p, o) => ({ env: { NITRO_PORT: p, PORT: o } })],
    ['PORT over the config', (p) => ({ env: { PORT: p } })],
    [
      'the config over a PORT in .env',
      (p, o) => ({ configPort: p, files: { '.env': `PORT=${o}` } }),
    ],
  ])('takes %s, as `nuxt dev` does', async (_, setup) => {
    prepare(setup);

    await expectToWaitForServer(waitForNuxtDevServer());
  });

  it.each<[string, string, (p: string, o: string) => Setup]>([
    [
      'nuxi@3.0.0',
      'takes PORT over --port',
      (p, o) => ({ args: ['--port', o], env: { PORT: p } }),
    ],
    [
      'nuxi@3.0.0',
      'skips a PORT that is not a number',
      (p) => ({ args: ['--port', p], env: { PORT: 'abc' } }),
    ],
    [
      'nuxi@3.1.1',
      'ignores NITRO_PORT',
      (p, o) => ({ env: { NITRO_PORT: o, PORT: p } }),
    ],
    [
      'nuxi@3.1.1',
      'ignores devServer.host',
      (p) => ({ configHost: UNREACHABLE_HOST, env: { PORT: p } }),
    ],
    [
      'nuxi@3.2.1',
      'takes devServer.port over NITRO_PORT',
      (p, o) => ({ configPort: p, env: { NITRO_PORT: o } }),
    ],
    [
      'nuxi@3.2.1',
      'takes devServer.host over NITRO_HOST',
      (p) => ({
        configPort: p,
        configHost: '127.0.0.1',
        env: { NITRO_HOST: UNREACHABLE_HOST },
      }),
    ],
    [
      'nuxi@3.6.2',
      'takes devServer.port over PORT',
      (p, o) => ({ configPort: p, env: { PORT: o } }),
    ],
    [
      'nuxi@3.6.2',
      'takes devServer.host over HOST',
      (p) => ({
        configPort: p,
        configHost: '127.0.0.1',
        env: { HOST: UNREACHABLE_HOST },
      }),
    ],
    [
      'nuxi@3.7.0',
      'ignores NUXT_HOST',
      (p) => ({ configPort: p, env: { NUXT_HOST: UNREACHABLE_HOST } }),
    ],
    [
      'nuxi@3.7.1',
      'reads no -p',
      (p, o) => ({ args: ['-p', o], configPort: p }),
    ],
    ['nuxi@3.7.2', 'reads -p', (p, o) => ({ args: ['-p', p], configPort: o })],
    [
      'nuxi@3.6.5',
      'ignores --cwd',
      (p, o) => ({
        args: ['--cwd', 'sub'],
        configPort: p,
        files: {
          'sub/nuxt.config.ts': `export default defineNuxtConfig({ devServer: { port: ${o} } });`,
        },
      }),
    ],
    [
      'nuxi@3.14.0',
      'ignores --envName',
      (p, o) => ({
        args: ['--envName', 'staging'],
        configPort: null,
        files: {
          'nuxt.config.ts': `export default defineNuxtConfig({ devServer: { port: ${p} }, $staging: { devServer: { port: ${o} } } });`,
        },
      }),
    ],
    [
      'nuxi@3.25.1',
      'ignores --extends',
      (p) => ({
        args: ['--extends', './a'],
        configPort: p,
        files: {
          'a/nuxt.config.ts': `export default defineNuxtConfig({ devServer: { host: '${UNREACHABLE_HOST}' } });`,
        },
      }),
    ],
    [
      'nuxi@3.8.4',
      'ignores devServer.host from an extended layer',
      (p) => ({
        configPort: null,
        files: {
          'nuxt.config.ts': `export default defineNuxtConfig({ extends: ['./base'], devServer: { port: ${p} } });`,
          'base/nuxt.config.ts': `export default defineNuxtConfig({ devServer: { host: '${UNREACHABLE_HOST}' } });`,
        },
      }),
    ],
    [
      '@nuxt/cli@3.29.0',
      'takes NUXT_PORT from .env over devServer.port',
      (p) => ({ files: { '.env': `NUXT_PORT=${p}` } }),
    ],
    [
      '@nuxt/cli@3.29.0',
      'keeps an empty --host over the env',
      (p) => ({ args: ['--host='], env: { NUXT_HOST: '::1', NUXT_PORT: p } }),
    ],
    [
      '@nuxt/cli@3.30.0',
      'takes devServer.port over NUXT_PORT',
      (p, o) => ({ configPort: p, env: { NUXT_PORT: o } }),
    ],
    [
      '@nuxt/cli@3.30.0',
      'takes devServer.host over NUXT_HOST',
      (p) => ({
        configPort: p,
        configHost: '127.0.0.1',
        env: { NUXT_HOST: UNREACHABLE_HOST },
      }),
    ],
    [
      '@nuxt/cli@3.30.0',
      'takes _PORT',
      (p, o) => ({ env: { _PORT: p, NUXT_PORT: o } }),
    ],
    [
      '@nuxt/cli@3.37.0',
      'takes _PORT',
      (p, o) => ({ env: { _PORT: p, NUXT_PORT: o } }),
    ],
    [
      'nuxi@',
      'takes _PORT without a version to match',
      (p, o) => ({ env: { _PORT: p, NUXT_PORT: o } }),
    ],
    [
      '@nuxt/cli@4.0.1',
      'ignores _PORT',
      (p, o) => ({ env: { _PORT: o, NUXT_PORT: p } }),
    ],
    [
      '@nuxt/cli@4.0.1',
      'keeps an empty --host over the env',
      (p) => ({ args: ['--host='], env: { NUXT_HOST: '::1', NUXT_PORT: p } }),
    ],
    [
      '@nuxt/cli@4.0.1',
      'skips an empty PORT',
      (p) => ({ configPort: p, env: { PORT: '' } }),
    ],
    [
      '@nuxt/cli@4.0.1',
      'loads every --dotenv',
      (p, o) => ({
        args: ['--dotenv', '.env.a', '--dotenv', '.env.b'],
        // The schema default reads these when it loads, once per process
        configPort: 'Number(process.env.NUXT_PORT || process.env.NITRO_PORT)',
        files: { '.env.a': `NUXT_PORT=${p}`, '.env.b': `NITRO_PORT=${o}` },
      }),
    ],
    [
      '@nuxt/cli@4.0.1',
      'extends every --extends',
      (p, o) => ({
        args: ['--extends', './a', '-e', './b'],
        configPort: null,
        files: {
          'a/nuxt.config.ts': `export default defineNuxtConfig({ devServer: { port: ${p} } });`,
          'b/nuxt.config.ts': `export default defineNuxtConfig({ devServer: { port: ${o} } });`,
        },
      }),
    ],
    [
      '@nuxt/cli@4.0.1',
      'reads the value of --open.url',
      (p, o) => ({
        args: ['--open.url', 'sub'],
        configPort: p,
        files: {
          'sub/nuxt.config.ts': `export default defineNuxtConfig({ devServer: { port: ${o} } });`,
        },
      }),
    ],
  ])('with CLI %s, %s', async (cli, _, setup) => {
    installCli(cli);
    prepare(setup);

    await expectToWaitForServer(waitForNuxtDevServer());
  });

  // @nuxt/cli 3.20 reads PORT from .env, and 3.37 reads it before loading .env
  it.each<[string, boolean, (p: string, o: string) => Setup]>([
    [
      'the CLI node_modules/.bin/nuxt links to',
      true,
      (p, o) => ({ configPort: o, files: { '.env': `PORT=${p}` } }),
    ],
    [
      "nuxt's CLI when node_modules/.bin/nuxt is a shim",
      false,
      (p, o) => ({ configPort: p, files: { '.env': `PORT=${o}` } }),
    ],
  ])('resolves the address as %s does', async (_, link, setup) => {
    const writePackage = (path: string, json: object) =>
      write(`node_modules/${path}/package.json`, JSON.stringify(json));
    writePackage('nuxt', {
      name: 'nuxt',
      dependencies: { '@nuxt/cli': '^3.32.0' },
    });
    writePackage('nuxt/node_modules/@nuxt/cli', {
      name: '@nuxt/cli',
      version: '3.37.0',
    });
    writePackage('@nuxt/cli', { name: '@nuxt/cli', version: '3.20.0' });
    write('node_modules/@nuxt/cli/bin/nuxi.mjs', '');
    if (link) {
      mkdirSync(join(dir, 'node_modules/.bin'));
      symlinkSync(
        '../@nuxt/cli/bin/nuxi.mjs',
        join(dir, 'node_modules/.bin/nuxt')
      );
    } else {
      write('node_modules/.bin/nuxt', '#!/bin/sh\n');
    }
    prepare(setup);

    await expectToWaitForServer(waitForNuxtDevServer());
  });

  it.each<[string, string, (p: string) => Setup]>([
    ['nuxi@3.1.1', 'devServer.port', (p) => ({ configPort: p })],
    [
      'nuxi@3.1.1',
      'a PORT that is not a number',
      () => ({ env: { PORT: 'abc' } }),
    ],
    [
      'nuxi@3.7.1',
      'devServer.port from an extended layer',
      (p) => ({
        configPort: null,
        files: {
          'nuxt.config.ts': `export default defineNuxtConfig({ extends: ['./base'] });`,
          'base/nuxt.config.ts': `export default defineNuxtConfig({ devServer: { port: ${p} } });`,
        },
      }),
    ],
  ])('waits on port 3000 with CLI %s, ignoring %s', async (cli, _, setup) => {
    installCli(cli);
    prepare(setup);
    // The test can't count on binding port 3000
    vi.mocked(waitUntilServing).mockResolvedValueOnce(undefined);

    await waitForNuxtDevServer();

    expect(waitUntilServing).toHaveBeenLastCalledWith([
      'http://127.0.0.1:3000/',
      'https://127.0.0.1:3000/',
      'http://[::1]:3000/',
      'https://[::1]:3000/',
    ]);
  });

  it('waits while `nuxt dev` answers 503', async () => {
    let status = 503;
    writeConfig('nuxt.config.ts', `{ devServer: { port: ${port} } }`);
    stubTaskOptions({});
    listeners.push(await serve(port, () => status));

    const wait = waitForNuxtDevServer();
    expect(await settle(wait, 750)).toBe(pending);
    status = 200;
    expect(await settle(wait, 2000)).toBeUndefined();
  });

  it.each([
    [['--envName', 'staging']],
    [['--cwd', 'sub']],
    [['--dotenv', '.env.local', 'sub']],
  ])('loads the config `nuxt dev` loads with args %j', async (args) => {
    writeConfig(
      'nuxt.config.ts',
      `{ devServer: { port: ${otherPort} }, $staging: { devServer: { port: ${port} } } }`
    );
    writeConfig('sub/nuxt.config.ts', `{ devServer: { port: ${port} } }`);
    stubTaskOptions({ args });

    await expectToWaitForServer(waitForNuxtDevServer());
  });

  it('applies the $development overrides, as `nuxt dev` sets NODE_ENV', async () => {
    writeConfig(
      'nuxt.config.ts',
      `{ devServer: { port: ${otherPort} }, $development: { devServer: { port: ${port} } } }`
    );
    vi.stubEnv('NODE_ENV', 'production');
    stubTaskOptions({});

    await expectToWaitForServer(waitForNuxtDevServer());
  });
});

function serve(port: number, status: () => number): Promise<Server> {
  const server = createHttpServer((_, res) => res.writeHead(status()).end());
  return new Promise((resolve, reject) => {
    server
      .once('error', reject)
      .listen(port, '127.0.0.1', () => resolve(server));
  });
}

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
