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
import { waitForReadiness } from './probes';
import { normalizeReadyWhen, type NormalizedReadyWhen } from './ready-when';

const machine = vi.hoisted(() => ({
  interfaces: {} as Record<string, Partial<NetworkInterfaceInfo>[]>,
}));
vi.mock('os', async () => ({
  ...(await vi.importActual('os')),
  networkInterfaces: () => machine.interfaces,
}));

const native = vi.hoisted(() => ({ wasm: false }));
vi.mock('../../native', async () => ({
  ...(await vi.importActual('../../native')),
  get IS_WASM() {
    return native.wasm;
  },
}));

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
      await expect(ready).resolves.toBeUndefined();
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
      await expect(wait({ port, interval: 10 })).resolves.toBeUndefined();
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
        const listener = createTcpServer();
        try {
          await new Promise<void>((resolve, reject) =>
            listener.once('error', reject).listen(0, address, resolve)
          );
        } catch (e) {
          // Some CI kernels have no IPv6 loopback
          if (e.code === 'EADDRNOTAVAIL') return;
          throw e;
        }
        try {
          const port = (listener.address() as AddressInfo).port;
          await expect(
            wait({ port, host, timeout: 2000, interval: 10 })
          ).resolves.toBeUndefined();
        } finally {
          await new Promise((r) => listener.close(r));
        }
      }
    );
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
      await expect(
        wait({ url: `${baseUrl}/`, interval: 10 })
      ).resolves.toBeUndefined();
      await expect(
        wait({ url: `${baseUrl}/app`, timeout: 50, interval: 10 })
      ).rejects.toThrow('did not become ready within 50ms');
    });

    it('accepts 403 as ready', async () => {
      status = 403;
      await expect(
        wait({ url: baseUrl, interval: 10 })
      ).resolves.toBeUndefined();
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
      ).resolves.toBeUndefined();
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
      await expect(ready).resolves.toBeUndefined();
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
