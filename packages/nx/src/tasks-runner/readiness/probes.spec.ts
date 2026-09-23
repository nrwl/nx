import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer, type Server } from 'node:http';
import {
  createServer as createTcpServer,
  type AddressInfo,
  type Socket,
} from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RunningTask } from '../running-tasks/running-task';
import { waitForReadiness } from './probes';
import { normalizeReadyWhen, type NormalizedReadyWhen } from './ready-when';

const native = vi.hoisted(() => ({ wasm: false }));
vi.mock('../../native', async () => ({
  ...(await vi.importActual('../../native')),
  get IS_WASM() {
    return native.wasm;
  },
}));

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
    return waitForReadiness(normalizeReadyWhen(readyWhen, 'app:serve'), {
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

    it('rejects when the task exposes no output', async () => {
      runningTask = {} as RunningTask;
      await expect(wait({ logMatches: 'x' })).rejects.toThrow(
        'declares "readyWhen.logMatches" but its output is not captured'
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

    it('retries until the status is in range', async () => {
      const ready = wait({ url: baseUrl, interval: 10 });
      setTimeout(() => (status = 200), 30);
      await expect(ready).resolves.toBeUndefined();
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
          'db:up'
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
          'db:up'
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
