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

  it('says hello, then sends ready once with its url', async () => {
    const { announceTaskReadySignal, signalTaskReady } =
      await import('./ready-signal');

    expect(announceTaskReadySignal()).toBe(true);
    expect(signalTaskReady({ url: 'http://localhost:4300/' })).toBe(true);
    expect(signalTaskReady({ url: 'http://localhost:9999/' })).toBe(false);
    await until(2);

    expect(received).toEqual([
      { type: 'nx-ready-signal:hello', taskId: 'app:serve' },
      {
        type: 'nx-ready-signal:ready',
        taskId: 'app:serve',
        url: 'http://localhost:4300/',
      },
    ]);
  });

  it('does nothing outside a task that waits for a signal', async () => {
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '');
    const { announceTaskReadySignal, signalTaskReady } =
      await import('./ready-signal');

    expect(announceTaskReadySignal()).toBe(false);
    expect(signalTaskReady()).toBe(false);
  });

  it('does not throw when Nx has gone away', async () => {
    server.close();
    const { signalTaskReady } = await import('./ready-signal');

    expect(signalTaskReady()).toBe(true);
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
