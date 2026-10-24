import {
  mockCjsModule,
  unmockCjsModule,
} from '@nx/devkit/internal-testing-utils';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer, Server, type AddressInfo } from 'net';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import {
  getRsbuildServerAddress,
  parseRsbuildFlags,
  waitForRsbuildServer,
} from './dev-server-ready-check';

describe('parseRsbuildFlags', () => {
  it.each([
    [
      { args: ['--port', '3000', '--host', '--env-mode=staging'] },
      { port: 3000, host: true, envMode: 'staging' },
    ],
    [
      { args: ['-c', 'a.config.ts', '-r=apps/a', '--env-dir', 'env'] },
      { config: 'a.config.ts', root: 'apps/a', envDir: 'env' },
    ],
    [
      { args: ['--config=a.config.ts', '--root', 'apps/a', '--envDir=env'] },
      { config: 'a.config.ts', root: 'apps/a', envDir: 'env' },
    ],
    [
      { config: 'a.config.ts', root: 'apps/a', envDir: 'env', envMode: 'x' },
      { config: 'a.config.ts', root: 'apps/a', envDir: 'env', envMode: 'x' },
    ],
    // mri gives `-c` the value of `--config`, the alias given first
    [
      { config: 'a.config.ts', args: ['-c', 'b.config.ts'] },
      { config: 'a.config.ts' },
    ],
  ])('reads the flags of %j', (options, flags) => {
    expect(parseRsbuildFlags(options, '2.0.15')).toEqual(flags);
  });

  it.each([
    // commander gives `--host` the next argument and keeps the port a string
    [
      '1.1.14',
      { args: ['--port', '3000', '--host', '--env-mode=staging'] },
      { port: '3000', host: '--env-mode=staging' },
    ],
    ['1.2.0-alpha.0', { args: ['--no-env', '--host', '0'] }, {}],
    ['1.3.3', { args: ['--no-env', '--host', '0'] }, { env: false }],
  ])('reads the flags Rsbuild %s reads from %j', (version, options, flags) => {
    expect(parseRsbuildFlags(options, version)).toEqual(flags);
  });
});

describe('getRsbuildServerAddress', () => {
  it('probes loopback unless a specific host is named', () => {
    expect(getRsbuildServerAddress({ port: 1, host: '0.0.0.0' })).toEqual({
      port: 1,
    });
    expect(getRsbuildServerAddress({ port: 1, host: 'dev.local' })).toEqual({
      port: 1,
      host: 'dev.local',
    });
  });
});

describe('waitForRsbuildServer', () => {
  let dir: string;
  let server: Server | undefined;
  const cwd = process.cwd();
  const argv = [...process.argv];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nx-rsbuild-ready-'));
  });

  afterEach(async () => {
    process.chdir(cwd);
    process.argv = [...argv];
    delete process.env.APP_PORT;
    delete process.env.PUBLIC_PORT;
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
    if (server) await close(server);
    server = undefined;
  });

  const portOne = 'export default { server: { port: 1 } };';
  const portFromEnvWhen = (condition: string) =>
    `export default ({ env, envMode, command }) => ({ server: { port: ${condition} ? Number(process.env.APP_PORT) : 1 } });`;

  it.each<{
    name: string;
    files: Record<string, string>;
    options?: Record<string, unknown>;
    unsetNodeEnv?: boolean;
  }>([
    {
      name: 'the env files of the mode the command implies',
      files: {
        'rsbuild.config.mjs': portFromEnvWhen(
          "env === 'development' && envMode === 'development'"
        ),
        '.env.development': 'APP_PORT=<port>',
      },
      unsetNodeEnv: true,
    },
    {
      name: 'the env files of --env-mode',
      files: {
        'rsbuild.config.mjs': portFromEnvWhen(
          "envMode === 'staging' && command === 'dev'"
        ),
        '.env.staging': 'APP_PORT=<port>',
      },
      options: { args: ['--env-mode=staging'] },
    },
    {
      name: 'the env files in --env-dir',
      files: {
        'rsbuild.config.mjs': portFromEnvWhen('process.env.APP_PORT'),
        'env/.env': 'APP_PORT=<port>',
      },
      options: { args: ['--env-dir', 'env'] },
    },
    {
      name: 'the public env vars a plugin reads from source.define',
      files: {
        'rsbuild.config.mjs': `export default { server: { port: 1 }, plugins: [{ name: 'port', setup(api) { api.modifyRsbuildConfig((config) => { config.server.port = Number(JSON.parse(config.source.define['process.env.PUBLIC_PORT'])); }); } }] };`,
        '.env': 'PUBLIC_PORT=<port>',
      },
    },
    {
      name: 'no env files with --no-env',
      files: {
        'rsbuild.config.mjs':
          'export default { server: { port: process.env.APP_PORT ? 1 : <port> } };',
        '.env': 'APP_PORT=1',
      },
      options: { args: ['--no-env'] },
    },
    {
      name: 'the config --config names',
      files: {
        'rsbuild.config.mjs': portOne,
        'other.config.mjs': 'export default { server: { port: <port> } };',
      },
      options: { args: ['-c', 'other.config.mjs'] },
    },
    {
      name: 'the config an override names',
      files: {
        'rsbuild.config.mjs': portOne,
        'other.config.mjs': 'export default { server: { port: <port> } };',
      },
      options: { __unparsed__: ['-c', 'other.config.mjs'] },
    },
    {
      name: 'the config in --root',
      files: {
        'rsbuild.config.mjs': portOne,
        'app/rsbuild.config.mjs':
          'export default { server: { port: <port> } };',
      },
      options: { args: ['--root=app'] },
    },
    {
      name: '--port over the config',
      files: { 'rsbuild.config.mjs': portOne },
      options: { port: '<port>' },
    },
    {
      name: 'a plugin',
      files: {
        'rsbuild.config.mjs': `export default { server: { port: 1 }, plugins: [{ name: 'port', setup(api) { api.modifyRsbuildConfig((config) => { config.server.port = <port>; }); } }] };`,
      },
    },
  ])(
    'waits for the port from $name',
    async ({ files, options, unsetNodeEnv }) => {
      const port = await getFreePort();
      const withPort = (text: string) => text.replaceAll('<port>', `${port}`);
      for (const [file, content] of Object.entries(files)) {
        mkdirSync(dirname(join(dir, file)), { recursive: true });
        writeFileSync(join(dir, file), withPort(content));
      }
      if (unsetNodeEnv) vi.stubEnv('NODE_ENV', undefined);
      vi.stubEnv(
        'NX_TASK_OPTIONS',
        withPort(JSON.stringify({ cwd: dir, ...options }))
      );

      const wait = waitForRsbuildServer('rsbuild.config.mjs', 'dev');
      expect(await settle(wait, 500)).toBe('pending');
      server = await listen(port, '127.0.0.1');
      expect(await settle(wait, 2000)).toBe('resolved');
    }
  );

  it('waits for the config port in preview when a plugin throws while generating the bundler config', async () => {
    const port = await getFreePort();
    writeFileSync(
      join(dir, 'rsbuild.config.mjs'),
      `export default { server: { port: ${port} }, plugins: [{ name: 'throws', setup(api) { api.modifyRspackConfig(() => { throw new Error('boom'); }); } }] };`
    );
    vi.stubEnv('NX_TASK_OPTIONS', JSON.stringify({ cwd: dir }));

    const wait = waitForRsbuildServer('rsbuild.config.mjs', 'preview');
    expect(await settle(wait, 500)).toBe('pending');
    server = await listen(port, '127.0.0.1');
    expect(await settle(wait, 2000)).toBe('resolved');
  });

  it('rejects when --config-loader native cannot load the config', async () => {
    writeFileSync(
      join(dir, 'rsbuild.config.ts'),
      'enum Port { A = 1 }\nexport default { server: { port: Port.A } };'
    );
    vi.stubEnv(
      'NX_TASK_OPTIONS',
      JSON.stringify({ cwd: dir, args: ['--config-loader=native'] })
    );

    const wait = waitForRsbuildServer('rsbuild.config.ts', 'dev');
    expect(await settle(wait, 2000)).toMatch(/^rejected/);
  });

  it('parses the options the way the loaded @rsbuild/core does', async () => {
    mockCjsModule(import.meta.url, '@rsbuild/core', { version: '1.1.14' });
    vi.stubEnv(
      'NX_TASK_OPTIONS',
      JSON.stringify({ cwd: dir, args: ['--no-env'] })
    );
    try {
      await expect(
        waitForRsbuildServer('rsbuild.config.mjs', 'dev')
      ).rejects.toThrow("unknown option '--no-env'");
    } finally {
      unmockCjsModule(import.meta.url, '@rsbuild/core');
    }
  });
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

function settle(promise: Promise<unknown>, ms: number) {
  return Promise.race([
    promise.then(
      () => 'resolved',
      (e) => `rejected: ${e}`
    ),
    new Promise((r) => setTimeout(r, ms, 'pending')),
  ]);
}
