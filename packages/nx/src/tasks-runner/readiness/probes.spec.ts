import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer, type Server } from 'node:http';
import {
  createServer as createTcpServer,
  type AddressInfo,
  type Socket,
} from 'node:net';
import { tmpdir, type NetworkInterfaceInfo } from 'node:os';
import { join } from 'node:path';
import type { RunningTask } from '../running-tasks/running-task';
import { PseudoIPCClient } from '../pseudo-ipc';
import { waitForReadiness } from './probes';
import {
  READY_SIGNAL_SOCKET_ENV,
  type ReadySignalMessage,
} from './ready-signal';
import { ReadySignalServer } from './ready-signal-server';
import { normalizeReadyWhen, type NormalizedReadyWhen } from './ready-when';

const machine = vi.hoisted(() => ({
  interfaces: {} as Record<string, Partial<NetworkInterfaceInfo>[]>,
}));
vi.mock('os', async () => ({
  ...(await vi.importActual('os')),
  networkInterfaces: () => machine.interfaces,
}));

const native = vi.hoisted(() => ({
  wasm: false,
  // Replaces the native probe's wait when set
  wait: undefined as undefined | (() => Promise<boolean>),
}));
vi.mock('../../native', async () => {
  const actual =
    await vi.importActual<typeof import('../../native')>('../../native');
  class ReadinessProbe extends actual.ReadinessProbe {
    wait() {
      return native.wait ? native.wait() : super.wait();
    }
  }
  return {
    ...actual,
    ReadinessProbe,
    get IS_WASM() {
      return native.wasm;
    },
  };
});

const data = {
  workspaceRoot: '/workspace',
  projectRoot: 'app',
  projectName: 'app',
  options: {},
};

describe('waitForReadiness', () => {
  let outputListeners: ((chunk: string) => void)[];
  let runningTask: RunningTask;
  let controller: AbortController;

  beforeEach(() => {
    outputListeners = [];
    runningTask = {
      onOutput: (cb) => outputListeners.push(cb),
    } as RunningTask;
    controller = new AbortController();
  });

  function wait(readyWhen: Parameters<typeof normalizeReadyWhen>[0]) {
    return waitForReadiness(normalizeReadyWhen(readyWhen, 'app:serve', data), {
      taskId: 'app:serve',
      runningTask,
      cwd: process.cwd(),
      signal: controller.signal,
    });
  }

  const emit = (chunk: string) => outputListeners.forEach((cb) => cb(chunk));
  const settled = (promise: Promise<unknown>) =>
    Promise.race([
      promise.then(
        () => 'resolved',
        () => 'rejected'
      ),
      new Promise((r) => setTimeout(() => r('pending'), 20)),
    ]);

  it('rejects with a clear error on the WASM build, where the probes do not exist', async () => {
    native.wasm = true;
    try {
      await expect(wait({ logMatches: 'ready' })).rejects.toThrow(
        'The WASM build of Nx does not support "readyWhen", so "app:serve" cannot be probed for readiness.'
      );
    } finally {
      native.wasm = false;
    }
  });

  describe('logMatches', () => {
    it('resolves once every entry has appeared', async () => {
      const ready = wait({ logMatches: ['listening', 'ready'] });
      emit('server listening');
      await expect(settled(ready)).resolves.toBe('pending');
      emit('ready');
      await expect(ready).resolves.toEqual({});
    });

    it('rejects on timeout, naming the task and the probe', async () => {
      await expect(wait({ logMatches: 'never', timeout: 20 })).rejects.toThrow(
        'Task "app:serve" did not become ready within 20ms (readyWhen: logMatches "never").'
      );
    });

    it('rejects when aborted', async () => {
      const ready = wait({ logMatches: 'never' });
      controller.abort();
      await expect(ready).rejects.toThrow(
        'Task "app:serve" exited before it became ready.'
      );
    });
  });

  describe('port', () => {
    let server: ReturnType<typeof createTcpServer>;
    let port: number;

    beforeEach(async () => {
      server = createTcpServer();
      await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
      port = (server.address() as AddressInfo).port;
    });

    afterEach(async () => {
      await new Promise((r) => server.close(r));
    });

    it('resolves once the port accepts connections', async () => {
      await expect(wait({ port, interval: 10 })).resolves.toEqual({});
    });

    // Only the listener's address accepts on its port, so the check passes
    // only on the address the dev server picks
    const ip = (
      address: string,
      internal = false
    ): Partial<NetworkInterfaceInfo> => ({
      address,
      family: address.includes(':') ? 'IPv6' : 'IPv4',
      internal,
    });
    async function listenOn(address: string): Promise<number | null> {
      const listener = createTcpServer();
      try {
        await new Promise<void>((resolve, reject) =>
          listener.once('error', reject).listen(0, address, resolve)
        );
      } catch (e) {
        // Some CI kernels have no IPv6 loopback
        if (e.code === 'EADDRNOTAVAIL') return null;
        throw e;
      }
      onTestFinished(async () => {
        await new Promise((r) => listener.close(r));
      });
      return (listener.address() as AddressInfo).port;
    }
    it.each([
      // The first non-internal IPv4 address, before any IPv6 one
      [
        'local-ip',
        '127.0.0.1',
        {
          lo: [ip('10.255.255.1', true)],
          en0: [ip('fd00::1'), ip('127.0.0.1')],
        },
      ],
      // Then IPv6, where a global address is not one the dev server takes
      [
        'local-ip',
        '::1',
        {
          lo: [ip('127.0.0.1', true)],
          en0: [ip('2001:db8::1'), ip('::1')],
        },
      ],
      // Without one the dev server listens on 0.0.0.0
      ['local-ipv4', '127.0.0.1', { lo: [ip('10.255.255.1', true)] }],
      // or on ::
      ['local-ipv6', '::1', { lo: [ip('::1', true)], en0: [ip('127.0.0.1')] }],
    ])(
      'checks %s on the address the dev server resolves it to',
      async (host, address, interfaces) => {
        machine.interfaces = interfaces;
        const port = await listenOn(address);
        if (port === null) return;
        await expect(
          wait({ port, host, timeout: 2000, interval: 10 })
        ).resolves.toEqual({});
      }
    );

    it('never checks local-ipv4 on an IPv6 address', async () => {
      machine.interfaces = { lo: [ip('127.0.0.1', true)], en0: [ip('::1')] };
      const port = await listenOn('::1');
      if (port === null) return;
      await expect(
        wait({ port, host: 'local-ipv4', timeout: 100, interval: 10 })
      ).rejects.toThrow('did not become ready within 100ms');
    });
  });

  describe('url', () => {
    let server: Server;
    let status: number;
    let baseUrl: string;

    beforeEach(async () => {
      status = 503;
      server = createHttpServer((req, res) => {
        res.writeHead(status);
        res.end();
      });
      await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterEach(async () => {
      await new Promise((r) => server.close(r));
    });

    it('retries a 404 at the root at /index.html', async () => {
      server.removeAllListeners('request');
      server.on('request', (req, res) => {
        res.writeHead(req.url === '/index.html' ? 200 : 404);
        res.end();
      });
      await expect(wait({ url: `${baseUrl}/`, interval: 10 })).resolves.toEqual(
        {}
      );
      await expect(
        wait({ url: `${baseUrl}/app`, timeout: 50, interval: 10 })
      ).rejects.toThrow('did not become ready within 50ms');
    });

    it('accepts 403 as ready', async () => {
      status = 403;
      await expect(wait({ url: baseUrl, interval: 10 })).resolves.toEqual({});
    });

    it('counts a redirect as ready without requesting its target', async () => {
      const requested: string[] = [];
      server.removeAllListeners('request');
      server.on('request', (req, res) => {
        requested.push(req.url);
        if (req.url === '/redirect') {
          res.writeHead(302, { location: '/target' });
        } else {
          res.writeHead(503);
        }
        res.end();
      });
      await expect(
        wait({ url: `${baseUrl}/redirect`, interval: 10 })
      ).resolves.toEqual({});
      expect(requested).toEqual(['/redirect']);
    });

    it('closes the connection of a response whose body keeps streaming', async () => {
      const sockets = new Set<Socket>();
      server.on('connection', (socket) => {
        sockets.add(socket);
        socket.once('close', () => sockets.delete(socket));
      });
      server.removeAllListeners('request');
      server.on('request', (req, res) => {
        res.writeHead(503);
        const timer = setInterval(() => res.write('x'), 10);
        res.once('close', () => clearInterval(timer));
      });
      await expect(
        wait({ url: baseUrl, timeout: 100, interval: 20 })
      ).rejects.toThrow('did not become ready within 100ms');
      await new Promise((r) => setTimeout(r, 50));
      expect(sockets.size).toBe(0);
    });

    it('times out while a server keeps trickling headers', async () => {
      const sockets = new Set<Socket>();
      const trickle = createTcpServer((socket) => {
        sockets.add(socket);
        socket.write('HTTP/1.1 200 OK\r\n');
        const timer = setInterval(() => socket.write('X-Slow: 1\r\n'), 20);
        socket.once('close', () => clearInterval(timer));
      });
      await new Promise<void>((r) => trickle.listen(0, '127.0.0.1', r));
      const url = `http://127.0.0.1:${(trickle.address() as AddressInfo).port}`;
      try {
        const start = Date.now();
        await expect(wait({ url, timeout: 100, interval: 10 })).rejects.toThrow(
          'did not become ready within 100ms'
        );
        expect(Date.now() - start).toBeLessThan(200);
      } finally {
        sockets.forEach((socket) => socket.destroy());
        await new Promise((r) => trickle.close(r));
      }
    });
  });

  describe('signal', () => {
    let readySignal: ReadySignalServer;
    let client: PseudoIPCClient;

    beforeEach(async () => {
      readySignal = new ReadySignalServer();
      const env = await readySignal.env('app:serve');
      client = new PseudoIPCClient(env[READY_SIGNAL_SOCKET_ENV]);
    });

    afterEach(() => {
      client.close();
      readySignal.close();
    });

    const send = (message: Omit<ReadySignalMessage, 'taskId'>) =>
      client.sendMessageToParent({ ...message, taskId: 'app:serve' });

    function waitForSignal(
      readyWhen: Parameters<typeof normalizeReadyWhen>[0]
    ) {
      return waitForReadiness(
        normalizeReadyWhen(readyWhen, 'app:serve', data),
        {
          taskId: 'app:serve',
          runningTask,
          cwd: process.cwd(),
          signal: controller.signal,
          readySignal,
        }
      );
    }

    it('resolves with the url the producer reports', async () => {
      const ready = waitForSignal({ signal: true });
      await expect(settled(ready)).resolves.toBe('pending');
      send({ type: 'nx-ready-signal:ready', url: 'http://localhost:4300/' });
      await expect(ready).resolves.toEqual({ url: 'http://localhost:4300/' });
    });

    it('counts a signal sent before the check started', async () => {
      send({ type: 'nx-ready-signal:ready' });
      await new Promise((r) => setTimeout(r, 50));
      await expect(waitForSignal({ signal: true })).resolves.toEqual({});
    });

    it('ignores the signals of other tasks', async () => {
      const ready = waitForSignal({ signal: true, timeout: 200 });
      client.sendMessageToParent({
        type: 'nx-ready-signal:ready',
        taskId: 'other:serve',
      });
      await expect(ready).rejects.toThrow(
        'Task "app:serve" did not become ready within 200ms (readyWhen: signal).'
      );
    });

    it('resolves on the fallback when the producer never says hello', async () => {
      const ready = waitForSignal({
        signal: true,
        fallback: { logMatches: 'listening' },
      });
      await new Promise((r) => setTimeout(r, 20));
      emit('listening');
      await expect(ready).resolves.toEqual({});
    });

    it('stops the fallback once the producer says hello', async () => {
      const ready = waitForSignal({
        signal: true,
        fallback: { logMatches: 'listening' },
      });
      send({ type: 'nx-ready-signal:hello' });
      await new Promise((r) => setTimeout(r, 50));
      emit('listening');
      await expect(settled(ready)).resolves.toBe('pending');
      send({ type: 'nx-ready-signal:ready' });
      await expect(ready).resolves.toEqual({});
    });

    it('rejects on timeout, naming the fallback', async () => {
      await expect(
        waitForSignal({
          signal: true,
          timeout: 50,
          fallback: { command: 'exit 1', interval: 10 },
        })
      ).rejects.toThrow(
        'Task "app:serve" did not become ready within 50ms (readyWhen: signal, or command "exit 1").'
      );
    });

    it('works on the WASM build, where only the fallback has no probe', async () => {
      native.wasm = true;
      try {
        const ready = waitForSignal({
          signal: true,
          fallback: { logMatches: 'listening' },
        });
        send({ type: 'nx-ready-signal:ready' });
        await expect(ready).resolves.toEqual({});
      } finally {
        native.wasm = false;
      }
    });

    describe('when the fallback fails', () => {
      afterEach(() => {
        native.wait = undefined;
      });

      it('fails the check with an error other than a timeout', async () => {
        native.wait = () => Promise.reject(new Error('probe broke'));

        await expect(
          waitForSignal({ signal: true, fallback: { port: 1 } })
        ).rejects.toThrow('probe broke');
      });

      it('reports a fallback timeout as the signal check timing out', async () => {
        // The probe gives up before the signal's own timer
        native.wait = () => Promise.resolve(false);

        await expect(
          waitForSignal({
            signal: true,
            timeout: 10_000,
            fallback: { port: 1 },
          })
        ).rejects.toThrow(
          'Task "app:serve" did not become ready within 10000ms (readyWhen: signal, or port 1).'
        );
      });
    });

    it('rejects when aborted', async () => {
      const ready = waitForSignal({ signal: true });
      controller.abort();
      await expect(ready).rejects.toThrow(
        'Task "app:serve" exited before it became ready.'
      );
    });
  });

  describe('command', () => {
    let dir: string;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'nx-readiness-'));
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it('resolves once the command exits 0, run from the given cwd', async () => {
      const ready = waitForReadiness(
        normalizeReadyWhen(
          { command: 'test -f marker', interval: 10 },
          'db:up',
          data
        ),
        {
          taskId: 'db:up',
          runningTask,
          cwd: dir,
          signal: controller.signal,
        }
      );
      setTimeout(() => writeFileSync(join(dir, 'marker'), ''), 30);
      await expect(ready).resolves.toEqual({});
    });

    it('runs the command with the env it is given', async () => {
      const readyWhen: NormalizedReadyWhen = {
        kind: 'command',
        command: 'test "$NX_READY_GIVEN" = yes',
        env: { NX_READY_GIVEN: 'yes', PATH: process.env.PATH },
        timeout: 2000,
        interval: 10,
      };
      await expect(
        waitForReadiness(readyWhen, {
          taskId: 'db:up',
          runningTask,
          cwd: dir,
          signal: controller.signal,
        })
      ).resolves.toEqual({});
    });

    it('kills what the command spawned when it times out', async () => {
      const ready = waitForReadiness(
        normalizeReadyWhen(
          { command: 'sh -c "sleep 0.3; touch marker"; exit 1', timeout: 100 },
          'db:up',
          data
        ),
        { taskId: 'db:up', runningTask, cwd: dir, signal: controller.signal }
      );
      await expect(ready).rejects.toThrow('did not become ready within 100ms');
      await new Promise((r) => setTimeout(r, 500));
      expect(existsSync(join(dir, 'marker'))).toBe(false);
    });
  });

  it.each([
    [{ port: 1 }, 'port 1'],
    [{ port: 1, host: '127.0.0.1' }, 'port 127.0.0.1:1'],
    [{ url: 'http://127.0.0.1:1' }, 'url http://127.0.0.1:1'],
    [{ command: 'exit 1' }, 'command "exit 1"'],
  ])('rejects %j on timeout, naming the probe', async (probe, described) => {
    await expect(wait({ ...probe, timeout: 50, interval: 10 })).rejects.toThrow(
      `Task "app:serve" did not become ready within 50ms (readyWhen: ${described}).`
    );
  });

  it('stops polling once aborted', async () => {
    const readyWhen: NormalizedReadyWhen = {
      kind: 'command',
      command: 'exit 1',
      timeout: 10_000,
      interval: 10,
    };
    const ready = waitForReadiness(readyWhen, {
      taskId: 'app:serve',
      runningTask,
      cwd: process.cwd(),
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 30);
    await expect(ready).rejects.toThrow(
      'Task "app:serve" exited before it became ready.'
    );
  });
});
