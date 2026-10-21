import { createServer, Server, type AddressInfo } from 'net';
import {
  getReactRouterServeAddress,
  waitForReactRouterServe,
} from './react-router-serve-ready-check';

describe('getReactRouterServeAddress', () => {
  it.each([
    [{}, { port: 3000 }],
    [{ PORT: 'abc' }, { port: 3000 }],
    [{ PORT: '4000' }, { port: 4000 }],
    // react-router-serve listens on a port it picks
    [{ PORT: '' }, null],
    [
      { PORT: '4000', HOST: 'dev.local' },
      { port: 4000, host: 'dev.local' },
    ],
  ])('reads %j as %j', (env, address) => {
    expect(getReactRouterServeAddress(env)).toEqual(address);
  });
});

describe('waitForReactRouterServe', () => {
  const cwd = process.cwd();
  let server: Server;

  afterEach(async () => {
    process.chdir(cwd);
    vi.unstubAllEnvs();
    if (server?.listening) await new Promise((r) => server.close(r));
  });

  it('waits for the PORT of the task env', async () => {
    const port = await getFreePort();
    vi.stubEnv('PORT', String(port));
    vi.stubEnv('HOST', undefined);
    vi.stubEnv('NX_TASK_OPTIONS', JSON.stringify({ cwd }));
    const wait = waitForReactRouterServe();
    const settle = (ms: number) =>
      Promise.race([
        wait.then(() => 'resolved'),
        new Promise((r) => setTimeout(r, ms, 'pending')),
      ]);

    expect(await settle(500)).toBe('pending');
    server = await listen(port, '127.0.0.1');
    expect(await settle(3000)).toBe('resolved');
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
