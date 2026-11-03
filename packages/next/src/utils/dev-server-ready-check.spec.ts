import { mkdtempSync, rmSync } from 'fs';
import { createServer, Server, type AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  getNextServerAddress,
  waitForNextServer,
} from './dev-server-ready-check';

describe('getNextServerAddress', () => {
  it.each([
    [{}, {}, { port: 3000 }],
    [{}, { PORT: '4000' }, { port: 4000 }],
    [{}, { PORT: 'abc' }, { port: 3000 }],
    [
      { args: ['-p', '5001', '--port', '5000', '--hostname', 'dev.local'] },
      { PORT: '4000' },
      { port: 5000, host: 'dev.local' },
    ],
    [{ port: 5000 }, {}, { port: 5000 }],
    [
      { args: ['-p5000', '-Hdev.local'] },
      {},
      { port: 5000, host: 'dev.local' },
    ],
    [{ args: ['--', '-p', '5000'] }, {}, { port: 3000 }],
    [{ args: ['-p', '0'] }, {}, null],
  ])('reads %j with env %j', (options, env, address) => {
    expect(getNextServerAddress(options, env)).toEqual(address);
  });
});

describe('waitForNextServer', () => {
  let dir: string;
  let port: number;
  let otherPort: number;
  let listeners: Server[];
  const cwd = process.cwd();
  const pending = Symbol('pending');

  const settle = (wait: Promise<void>, ms: number) =>
    Promise.race([wait, new Promise((r) => setTimeout(r, ms, pending))]);

  // Fails on a check that resolves before the server listens
  async function expectToWaitForPort(wait: Promise<void>) {
    expect(await settle(wait, 500)).toBe(pending);
    listeners.push(await listen(port, '127.0.0.1'));
    await expect(wait).resolves.toBeUndefined();
  }

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'nx-next-ready-'));
    listeners = [];
    port = await getFreePort();
    do otherPort = await getFreePort();
    while (otherPort === port);
  });

  afterEach(async () => {
    process.chdir(cwd);
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
    await Promise.all(listeners.map(close));
  });

  it.each([
    ['PORT in the task env', () => ({ options: {}, env: port })],
    [
      '--port in the task options',
      () => ({ options: { args: [`--port=${port}`] }, env: otherPort }),
    ],
  ])('waits for the port from %s', async (_, source) => {
    const { options, env } = source();
    vi.stubEnv('PORT', String(env));
    vi.stubEnv('NX_TASK_OPTIONS', JSON.stringify({ cwd: dir, ...options }));

    await expectToWaitForPort(waitForNextServer());
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
