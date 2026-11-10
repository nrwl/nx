import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { createServer, Server, type AddressInfo } from 'net';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import {
  getMetroPort,
  parseExpoStartFlags,
  waitForExpoDevServer,
} from './dev-server-ready-check';

describe('parseExpoStartFlags', () => {
  it.each([
    // The shape convert-to-inferred writes
    [{ args: ['--port=3000'] }, { port: 3000, dev: true }],
    [
      { port: 3000, args: ['--clear'] },
      { port: 3000, dev: true },
    ],
    [{ args: ['-cp', '3000', '--no-dev'] }, { port: 3000, dev: false }],
    [{ args: ['--port', '1', '-p', '2'] }, { port: 2, dev: true }],
    [
      { args: ['--scheme', 'app', 'apps/mobile', 'other'] },
      { dev: true, projectRoot: 'apps/mobile' },
    ],
    [{ args: ['--', '--port', '3000'] }, { port: 3000, dev: true }],
    [
      { args: ['--', '--', '--port', '3000'] },
      { dev: true, projectRoot: '--port' },
    ],
  ])('parses %j', (options, flags) => {
    expect(parseExpoStartFlags(options)).toEqual(flags);
  });
});

describe('getMetroPort', () => {
  it.each([
    [undefined, 8081],
    ['3000', 3000],
    ['0', 8081],
  ])('takes RCT_METRO_PORT %j as port %d', (rctMetroPort, port) => {
    expect(getMetroPort(rctMetroPort)).toBe(port);
  });
});

describe('waitForExpoDevServer', () => {
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
  const settle = (wait: Promise<void>, ms: number) =>
    Promise.race([wait, new Promise((r) => setTimeout(r, ms, pending))]);

  // Fails on a check that resolves before the dev server listens
  async function expectToWaitForPort(wait: Promise<void>) {
    expect(await settle(wait, 500)).toBe(pending);
    listeners.push(await listen(port, '127.0.0.1'));
    await expect(wait).resolves.toBeUndefined();
  }

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'nx-expo-ready-'));
    // The check loads .env files with the @expo/env of the project's expo
    mkdirSync(join(dir, 'node_modules'));
    symlinkSync(
      dirname(require.resolve('expo/package.json')),
      join(dir, 'node_modules', 'expo'),
      'junction'
    );
    listeners = [];
    port = await getFreePort();
    do otherPort = await getFreePort();
    while (otherPort === port);
    vi.stubEnv('RCT_METRO_PORT', undefined);
    vi.stubEnv('NODE_ENV', undefined);
    vi.stubEnv('EXPO_NO_DOTENV', undefined);
  });

  afterEach(async () => {
    process.chdir(cwd);
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
    await Promise.all(listeners.map(close));
  });

  it.each<
    [
      string,
      (
        port: number,
        otherPort: number
      ) => {
        options: Record<string, unknown>;
        env?: Record<string, string>;
        files?: Record<string, string>;
      },
    ]
  >([
    [
      '--port over RCT_METRO_PORT',
      (port, otherPort) => ({
        options: { args: [`--port=${port}`] },
        env: { RCT_METRO_PORT: `${otherPort}` },
      }),
    ],
    [
      'the port option over RCT_METRO_PORT',
      (port, otherPort) => ({
        options: { port },
        env: { RCT_METRO_PORT: `${otherPort}` },
      }),
    ],
    [
      'RCT_METRO_PORT over the .env files',
      (port, otherPort) => ({
        options: {},
        env: { RCT_METRO_PORT: `${port}` },
        files: { '.env.development': `RCT_METRO_PORT=${otherPort}` },
      }),
    ],
    [
      'the .env files of development mode',
      (port, otherPort) => ({
        options: {},
        files: {
          '.env.development': `RCT_METRO_PORT=${port}`,
          '.env.production': `RCT_METRO_PORT=${otherPort}`,
        },
      }),
    ],
    [
      'the .env files of production mode with --no-dev',
      (port, otherPort) => ({
        options: { args: ['--no-dev'] },
        files: {
          '.env.development': `RCT_METRO_PORT=${otherPort}`,
          '.env.production': `RCT_METRO_PORT=${port}`,
        },
      }),
    ],
    [
      'the .env files of the project directory argument',
      (port, otherPort) => ({
        options: { args: ['apps/mobile'] },
        files: {
          '.env': `RCT_METRO_PORT=${otherPort}`,
          'apps/mobile/.env': `RCT_METRO_PORT=${port}`,
        },
      }),
    ],
  ])('waits for the port from %s', async (_, setup) => {
    const { options, env = {}, files = {} } = setup(port, otherPort);
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    for (const [path, content] of Object.entries(files)) write(path, content);
    vi.stubEnv('NX_TASK_OPTIONS', JSON.stringify({ cwd: dir, ...options }));

    await expectToWaitForPort(waitForExpoDevServer());
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
