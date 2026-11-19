import { mockCjsModule } from '@nx/devkit/internal-testing-utils';
import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import { nxReadySignal } from './ready-signal';

const devkit = vi.hoisted(() => ({
  emitReadySignal: vi.fn(() => true),
}));
// The signal helpers are required lazily, which `vi.mock` cannot reach
mockCjsModule(import.meta.url, '@nx/devkit', devkit);

describe('nxReadySignal', () => {
  let server: Server;
  let port: number;
  let status: number;

  // Runs each hook's functions in turn, in the order they were added, as Nuxt does
  function install() {
    const hooks: Record<string, Array<(...args: any[]) => unknown>> = {};
    const nuxt = {
      hook: (name: string, fn: (...args: any[]) => unknown) => {
        (hooks[name] ??= []).push(fn);
      },
      callHook: async (name: string, ...args: unknown[]) => {
        for (const fn of hooks[name] ?? []) await fn(...args);
      },
    };
    nxReadySignal({}, nuxt);
    return { hooks, ...nuxt };
  }

  beforeEach(async () => {
    status = 503;
    server = createServer((_, res) => res.writeHead(status).end());
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    devkit.emitReadySignal.mockClear();
    await new Promise((r) => server.close(r));
  });

  it.each([
    // The CLI's URL, which is its proxy's when the server runs behind one
    [
      'the listener url',
      (p: number) => ({ url: `http://localhost:${p}/`, https: false }),
      (p: number) => `http://localhost:${p}/`,
    ],
    [
      'a wildcard listener url on localhost',
      (p: number) => ({ url: `http://0.0.0.0:${p}/`, https: false }),
      (p: number) => `http://localhost:${p}/`,
    ],
    [
      'the address of a listener without a url',
      () => ({ https: false }),
      (p: number) => `http://127.0.0.1:${p}/`,
    ],
  ])(
    'signals %s once the dev server has built and stops answering 503',
    async (_, listener, url) => {
      vi.stubEnv('NX_READY_SIGNAL_SOCKET', '/tmp/nx-ready.sock');
      const nuxt = install();
      const address = () => ({ address: '127.0.0.1', family: 'IPv4', port });

      await nuxt.callHook('listen', { address }, listener(port));
      // Returns while the server answers 503, as the CLI serves the app after it
      await nuxt.callHook('build:done');
      await new Promise((r) => setTimeout(r, 600));
      expect(devkit.emitReadySignal).not.toHaveBeenCalled();

      status = 404;
      await vi.waitFor(
        () => expect(devkit.emitReadySignal).toHaveBeenCalledWith(url(port)),
        { timeout: 2000 }
      );
    }
  );

  it('signals without a url once serving when nuxi 3.7.0 to 3.7.2 pass no listener', async () => {
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '/tmp/nx-ready.sock');
    const nuxt = install();
    const address = () => ({ address: '127.0.0.1', family: 'IPv4', port });

    await nuxt.callHook('listen', { address }, {});
    await nuxt.callHook('build:done');
    await new Promise((r) => setTimeout(r, 600));
    expect(devkit.emitReadySignal).not.toHaveBeenCalled();

    status = 404;
    await vi.waitFor(
      () => expect(devkit.emitReadySignal).toHaveBeenCalledWith(),
      { timeout: 2000 }
    );
  });

  it('signals without a url once built when the server listens on a socket', async () => {
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '/tmp/nx-ready.sock');
    const nuxt = install();

    await nuxt.callHook(
      'listen',
      { address: () => '/tmp/nuxt.sock' },
      { https: false }
    );
    await nuxt.callHook('build:done');

    expect(devkit.emitReadySignal).toHaveBeenCalledWith();
  });

  it('does nothing outside a signalling task', () => {
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '');

    expect(install().hooks).toEqual({});
    expect(devkit.emitReadySignal).not.toHaveBeenCalled();
  });
});
