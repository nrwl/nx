import type { ReadySignalMessage } from './ready-signal';
import { ReadySignalServer } from './ready-signal-server';

describe('ready signal client', () => {
  let server: ReadySignalServer;
  let received: ReadySignalMessage[];

  beforeEach(async () => {
    vi.resetModules();
    server = new ReadySignalServer();
    received = [];
    for (const [key, value] of Object.entries(await server.env('app:serve'))) {
      vi.stubEnv(key, value);
    }
    server.subscribe('app:serve', (message) => received.push(message));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    server.close();
  });

  const until = async (count: number) => {
    for (let i = 0; i < 100 && received.length < count; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
  };

  it('sends ready once, with its url', async () => {
    const { emitReadySignal } = await import('./ready-signal');

    expect(emitReadySignal('http://localhost:4300/')).toBe(true);
    expect(emitReadySignal('http://localhost:9999/')).toBe(false);
    await until(1);

    expect(received).toEqual([
      {
        type: 'nx-ready-signal:ready',
        taskId: 'app:serve',
        url: 'http://localhost:4300/',
      },
    ]);
  });

  it.each([
    [
      { address: '127.0.0.1', family: 'IPv4', port: 4300 },
      'http://127.0.0.1:4300/',
    ],
    [{ address: '::', family: 'IPv6', port: 4300 }, 'http://localhost:4300/'],
    [{ address: '::1', family: 'IPv6', port: 4300 }, 'http://[::1]:4300/'],
  ])('sends the url of a server listening on %j', async (address, url) => {
    const { emitReadySignal } = await import('./ready-signal');

    expect(emitReadySignal({ address: () => address })).toBe(true);
    await until(1);

    expect(received).toEqual([
      { type: 'nx-ready-signal:ready', taskId: 'app:serve', url },
    ]);
  });

  it('sends an https url for a TLS server', async () => {
    const { Server } = await import('tls');
    const tlsServer = Object.assign(Object.create(Server.prototype), {
      address: () => ({ address: '0.0.0.0', family: 'IPv4', port: 4300 }),
    });
    const { emitReadySignal } = await import('./ready-signal');

    emitReadySignal(tlsServer);
    await until(1);

    expect(received[0].url).toBe('https://localhost:4300/');
  });

  it('sends ready without a url for a server on a pipe', async () => {
    const { emitReadySignal } = await import('./ready-signal');

    emitReadySignal({ address: () => '/tmp/app.sock' });
    await until(1);

    expect(received).toEqual([
      { type: 'nx-ready-signal:ready', taskId: 'app:serve' },
    ]);
  });

  it('does not report a server that is not listening, so a later call still counts', async () => {
    const { emitReadySignal } = await import('./ready-signal');

    expect(emitReadySignal({ address: () => null })).toBe(false);
    expect(emitReadySignal('http://localhost:4300/')).toBe(true);
    await until(1);

    expect(received).toEqual([
      {
        type: 'nx-ready-signal:ready',
        taskId: 'app:serve',
        url: 'http://localhost:4300/',
      },
    ]);
  });

  it('does nothing outside a task that waits for a signal', async () => {
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '');
    const { emitReadySignal } = await import('./ready-signal');

    expect(emitReadySignal()).toBe(false);
  });

  it('does not throw when Nx has gone away', async () => {
    server.close();
    const { emitReadySignal } = await import('./ready-signal');

    expect(emitReadySignal()).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
  });
});

describe('getReadyUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const at = async (ready: string | undefined, configured?: string) => {
    vi.stubEnv('NX_READY_URL', ready);
    const { getReadyUrl } = await import('./ready-signal');
    return getReadyUrl(configured);
  };

  it('moves the configured url to the reported port, keeping its path and query', async () => {
    expect(
      await at('http://[::1]:4300/', 'http://localhost:4200/app/?x=1')
    ).toBe('http://localhost:4300/app/?x=1');
  });

  it('takes the reported host and protocol when either host is not loopback', async () => {
    expect(
      await at('https://10.0.0.5:4300/', 'http://localhost:4200/app')
    ).toBe('https://10.0.0.5:4300/app');
    expect(await at('http://127.0.0.1:4300/', 'http://dev.local:4200/')).toBe(
      'http://127.0.0.1:4300/'
    );
  });

  it('takes the reported host when the configured one is a loopback IP of another family', async () => {
    // A server bound to ::1 alone refuses 127.0.0.1
    expect(await at('http://[::1]:4200/', 'http://127.0.0.1:4200/app')).toBe(
      'http://[::1]:4200/app'
    );
  });

  it('switches between http and https with the server', async () => {
    expect(
      await at('https://localhost:4300/', 'http://localhost:4200/app')
    ).toBe('https://localhost:4300/app');
  });

  it('falls back to whichever url there is', async () => {
    expect(await at(undefined, 'http://localhost:4200')).toBe(
      'http://localhost:4200'
    );
    expect(await at('http://localhost:4300/', undefined)).toBe(
      'http://localhost:4300/'
    );
    expect(await at('http://localhost:4300/', 'not a url')).toBe(
      'http://localhost:4300/'
    );
  });
});
