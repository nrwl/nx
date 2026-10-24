import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer, Server, type AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  getViteServerAddress,
  parseViteFlags,
  waitForViteServer,
} from './dev-server-ready-check';

// `Function('return import("vite")')` has no dynamic import callback in the vm
vi.mock('./executor-utils', () => ({
  loadViteDynamicImport: () => import('vite'),
}));

describe('parseViteFlags', () => {
  it.each([
    [
      { args: ['--port', '3000', '--host', '--mode=staging'] },
      'serve',
      { port: '3000', host: true, mode: 'staging' },
    ],
    [
      { args: ['-m', 'prod', '-c', 'other.config.ts'] },
      'serve',
      { mode: 'prod', config: 'other.config.ts' },
    ],
    [{ config: 'other.config.ts' }, 'serve', { config: 'other.config.ts' }],
    // Vite keeps the values of the spelling that comes first
    [{ mode: 'dev', args: ['-m', 'prod'] }, 'serve', { mode: 'dev' }],
    [{ m: 'a', mode: 'b' }, 'serve', { mode: 'a' }],
    // run-commands drops a named option that args set to another value
    [{ mode: 'x', args: ['-m', 'y', '--mode', 'z'] }, 'serve', { mode: 'y' }],
    [{ args: ['--cors', 'apps/foo'] }, 'serve', { root: 'apps/foo' }],
    [{ args: ['--cors', 'apps/foo'] }, 'preview', {}],
    [{ args: ['--open', 'apps/foo', '--', 'apps/bar'] }, 'serve', {}],
  ] as const)('parses %j for %s', (options, command, flags) => {
    expect(parseViteFlags(options, command)).toEqual(flags);
  });

  it.each([
    [['-p', '4000'], { port: '4000' }],
    // The last value wins across an option's spellings
    [['--port', '1', '-p', '2'], { port: '2' }],
    [['--profile', 'apps/foo'], { root: 'apps/foo' }],
    [['--watch', 'apps/foo'], { root: 'apps/foo' }],
    [['--json', 'apps/foo'], { root: 'apps/foo' }],
    [['--typescript', 'apps/foo'], { root: 'apps/foo' }],
    [['--host=0.0.0.0'], { host: '0.0.0.0' }],
  ])('parses %j as react-router dev does', (args, flags) => {
    expect(parseViteFlags({ args }, 'react-router-dev')).toEqual(flags);
  });
});

describe('getViteServerAddress', () => {
  it("takes the flag, then the config, then Vite's default port", () => {
    expect(
      getViteServerAddress({ port: 5000 }, { port: '3000' }, 'serve')
    ).toEqual({ port: 3000 });
    expect(getViteServerAddress({ port: 5000 }, {}, 'serve')).toEqual({
      port: 5000,
    });
    expect(getViteServerAddress({}, {}, 'serve')).toEqual({ port: 5173 });
    expect(getViteServerAddress({}, {}, 'preview')).toEqual({ port: 4173 });
  });

  it('probes loopback unless a specific host is named', () => {
    expect(getViteServerAddress({ port: 1, host: true }, {}, 'serve')).toEqual({
      port: 1,
    });
    expect(
      getViteServerAddress({ port: 1, host: 'dev.local' }, {}, 'serve')
    ).toEqual({ port: 1, host: 'dev.local' });
  });
});

describe('waitForViteServer', () => {
  let dir: string;
  let port: number;
  let server: Server;
  const cwd = process.cwd();

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'nx-vite-ready-'));
    server = createServer();
    port = await getFreePort();
  });

  afterEach(async () => {
    process.chdir(cwd);
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
    if (server.listening) await new Promise((r) => server.close(r));
  });

  async function expectReadyOnListen(wait: Promise<void>) {
    const settle = (ms: number) =>
      Promise.race([
        wait.then(() => 'resolved'),
        new Promise((r) => setTimeout(r, ms, 'pending')),
      ]);
    expect(await settle(500)).toBe('pending');
    await new Promise<void>((r) => server.listen(port, '127.0.0.1', r));
    expect(await settle(3000)).toBe('resolved');
  }

  it('reads the port the config computes from the task env', async () => {
    const config = join(dir, 'vite.config.mjs');
    writeFileSync(
      config,
      `export default ({ mode }) => ({ server: { port: mode === 'development' ? Number(process.env.APP_PORT) : 1 } });`
    );
    vi.stubEnv('APP_PORT', String(port));
    vi.stubEnv('NX_TASK_OPTIONS', JSON.stringify({ cwd: dir }));

    await expectReadyOnListen(waitForViteServer(config, 'serve'));
  });

  it('reads the preview port in preview', async () => {
    const config = join(dir, 'vite.config.mjs');
    writeFileSync(
      config,
      `export default { server: { port: 1 }, preview: { port: ${port} } };`
    );
    vi.stubEnv('NX_TASK_OPTIONS', JSON.stringify({ cwd: dir }));

    await expectReadyOnListen(waitForViteServer(config, 'preview'));
  });

  it.each([
    ['serve', 'production'],
    ['preview', 'staging'],
  ] as const)(
    "defaults NODE_ENV the way `vite %s` does in mode '%s'",
    async (command, mode) => {
      writeFileSync(
        join(dir, 'vite.config.mjs'),
        `const port = (env) => (process.env.NODE_ENV === env ? ${port} : 1);
        export default { server: { port: port('development') }, preview: { port: port('production') } };`
      );
      vi.stubEnv('NODE_ENV', undefined);
      vi.stubEnv('NX_TASK_OPTIONS', JSON.stringify({ cwd: dir, mode }));

      await expectReadyOnListen(waitForViteServer('vite.config.mjs', command));
    }
  );

  it.each([[['-c', 'other.config.mjs']], [['sub']]])(
    'loads the config Vite loads with args %j',
    async (args) => {
      writeFileSync(
        join(dir, 'vite.config.mjs'),
        `export default { server: { port: 1 } };`
      );
      const ready = `export default { server: { port: ${port} } };`;
      writeFileSync(join(dir, 'other.config.mjs'), ready);
      mkdirSync(join(dir, 'sub'));
      writeFileSync(join(dir, 'sub', 'vite.config.mjs'), ready);
      vi.stubEnv('NX_TASK_OPTIONS', JSON.stringify({ cwd: dir, args }));

      await expectReadyOnListen(waitForViteServer('vite.config.mjs', 'serve'));
    }
  );

  it('reads the dev server flags of react-router dev', async () => {
    writeFileSync(
      join(dir, 'vite.config.mjs'),
      `export default { server: { port: 1 } };`
    );
    vi.stubEnv(
      'NX_TASK_OPTIONS',
      JSON.stringify({ cwd: dir, args: ['-p', String(port)] })
    );

    await expectReadyOnListen(
      waitForViteServer('vite.config.mjs', 'react-router-dev')
    );
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
