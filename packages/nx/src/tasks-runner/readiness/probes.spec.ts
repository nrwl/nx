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

  describe('logMatches', () => {
    it('resolves once every entry has appeared, split across chunks and colored', async () => {
      const ready = wait({ logMatches: ['listening', 'ready'] });
      emit('\x1b[32mserver lis');
      emit('tening\x1b[0m');
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

    it('resolves a host name', async () => {
      await expect(
        wait({ port, host: 'localhost', interval: 10 })
      ).resolves.toBeUndefined();
    });

    it('accepts a server bound to ::1 only unless a host is given', async () => {
      await new Promise((r) => server.close(r));
      server = createTcpServer();
      await new Promise<void>((r) => server.listen(port, '::1', r));
      await expect(wait({ port, interval: 10 })).resolves.toBeUndefined();
      await expect(
        wait({ port, host: '127.0.0.1', timeout: 50, interval: 10 })
      ).rejects.toThrow(
        `Task "app:serve" did not become ready within 50ms (readyWhen: port 127.0.0.1:${port}).`
      );
    });

    it('rejects on timeout when nothing listens', async () => {
      await new Promise((r) => server.close(r));
      server = createTcpServer();
      await expect(wait({ port, timeout: 50, interval: 10 })).rejects.toThrow(
        `Task "app:serve" did not become ready within 50ms (readyWhen: port ${port}).`
      );
    });
  });

  describe('url', () => {
    let server: Server;
    let status: number;
    let baseUrl: string;

    beforeEach(async () => {
      status = 503;
      server = createHttpServer((req, res) => {
        if (req.url === '/redirect') {
          res.writeHead(302, { location: '/' });
          res.end();
          return;
        }
        if (req.url.startsWith('/slow-redirect/')) {
          const hop = Number(req.url.slice('/slow-redirect/'.length));
          setTimeout(() => {
            res.writeHead(302, {
              location: hop > 0 ? `/slow-redirect/${hop - 1}` : '/',
            });
            res.end();
          }, 40);
          return;
        }
        if (req.url === '/loop') {
          res.writeHead(302, { location: '/loop' });
          res.end();
          return;
        }
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

    it.each([401, 403])('accepts %i as ready', async (code) => {
      status = code;
      await expect(
        wait({ url: baseUrl, interval: 10 })
      ).resolves.toBeUndefined();
    });

    it('follows a redirect to the final status', async () => {
      status = 200;
      await expect(
        wait({ url: `${baseUrl}/redirect`, interval: 10 })
      ).resolves.toBeUndefined();
    });

    it('charges every redirect hop against the one timeout', async () => {
      status = 200;
      const start = Date.now();
      await expect(
        wait({ url: `${baseUrl}/slow-redirect/5`, timeout: 100, interval: 10 })
      ).rejects.toThrow('did not become ready within 100ms');
      expect(Date.now() - start).toBeLessThan(200);
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

    it('does not treat a redirect loop as ready', async () => {
      await expect(
        wait({ url: `${baseUrl}/loop`, timeout: 100, interval: 10 })
      ).rejects.toThrow('did not become ready within 100ms');
    });

    it('rejects on timeout while the status stays out of range', async () => {
      await expect(
        wait({ url: baseUrl, timeout: 50, interval: 10 })
      ).rejects.toThrow(
        `Task "app:serve" did not become ready within 50ms (readyWhen: url ${baseUrl}).`
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

    it('rejects on timeout while the command keeps failing', async () => {
      await expect(
        wait({ command: 'exit 1', timeout: 50, interval: 10 })
      ).rejects.toThrow(
        'Task "app:serve" did not become ready within 50ms (readyWhen: command "exit 1").'
      );
    });
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
