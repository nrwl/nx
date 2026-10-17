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
