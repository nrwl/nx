import { createServer as createHttpServer, type Server } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import type { ExecutorContext } from '@nx/devkit';
import waitForWebserverExecutor from './wait-for-webserver.impl';

const context = {} as ExecutorContext;

describe('waitForWebserverExecutor', () => {
  it('resolves once a TCP server accepts connections on the port', async () => {
    const server = createTcpServer();
    await listen(server, 0);
    const { port } = server.address() as AddressInfo;

    const result = await waitForWebserverExecutor(
      { servers: [{ port }] },
      context
    );

    expect(result).toEqual({ success: true });
    await close(server);
  });

  it('resolves once an HTTP server responds with a 2xx status', async () => {
    const server = createHttpServer((_req, res) => res.end('ok'));
    await listen(server, 0);
    const { port } = server.address() as AddressInfo;

    const result = await waitForWebserverExecutor(
      { servers: [{ url: `http://127.0.0.1:${port}` }] },
      context
    );

    expect(result).toEqual({ success: true });
    await close(server);
  });

  it('treats an early 4xx (e.g. 403) response as ready, like Playwright', async () => {
    const server = createHttpServer((_req, res) => {
      res.statusCode = 403;
      res.end();
    });
    await listen(server, 0);
    const { port } = server.address() as AddressInfo;

    const result = await waitForWebserverExecutor(
      { servers: [{ url: `http://127.0.0.1:${port}` }] },
      context
    );

    expect(result).toEqual({ success: true });
    await close(server);
  });

  it('falls back to /index.html when the root url returns 404', async () => {
    const server = createHttpServer((req, res) => {
      res.statusCode = req.url === '/index.html' ? 200 : 404;
      res.end();
    });
    await listen(server, 0);
    const { port } = server.address() as AddressInfo;

    const result = await waitForWebserverExecutor(
      { servers: [{ url: `http://127.0.0.1:${port}` }] },
      context
    );

    expect(result).toEqual({ success: true });
    await close(server);
  });

  it('follows redirects and evaluates the destination status, like Playwright', async () => {
    const server = createHttpServer((req, res) => {
      if (req.url === '/') {
        res.statusCode = 302;
        res.setHeader('location', '/ready');
        res.end();
        return;
      }
      res.statusCode = 200;
      res.end();
    });
    await listen(server, 0);
    const { port } = server.address() as AddressInfo;

    const result = await waitForWebserverExecutor(
      { servers: [{ url: `http://127.0.0.1:${port}` }] },
      context
    );

    expect(result).toEqual({ success: true });
    await close(server);
  });

  it('does not treat a redirect to an unavailable destination as ready', async () => {
    const server = createHttpServer((req, res) => {
      if (req.url === '/') {
        res.statusCode = 302;
        res.setHeader('location', '/still-booting');
        res.end();
        return;
      }
      res.statusCode = 503;
      res.end();
    });
    await listen(server, 0);
    const { port } = server.address() as AddressInfo;

    const result = await waitForWebserverExecutor(
      { servers: [{ url: `http://127.0.0.1:${port}` }], timeout: 300 },
      context
    );

    expect(result).toEqual({ success: false });
    await close(server);
  });

  it('waits for a slow endpoint that responds past the retry interval, like Playwright', async () => {
    const server = createHttpServer((_req, res) => {
      setTimeout(() => {
        res.statusCode = 200;
        res.end();
      }, 1200);
    });
    await listen(server, 0);
    const { port } = server.address() as AddressInfo;

    const result = await waitForWebserverExecutor(
      { servers: [{ url: `http://127.0.0.1:${port}` }], timeout: 4000 },
      context
    );

    expect(result).toEqual({ success: true });
    await close(server);
  }, 10000);

  it('does not treat a 5xx response as ready', async () => {
    const server = createHttpServer((_req, res) => {
      res.statusCode = 503;
      res.end();
    });
    await listen(server, 0);
    const { port } = server.address() as AddressInfo;

    const result = await waitForWebserverExecutor(
      { servers: [{ url: `http://127.0.0.1:${port}` }], timeout: 300 },
      context
    );

    expect(result).toEqual({ success: false });
    await close(server);
  });

  it('fails when the server never becomes reachable before the timeout', async () => {
    // Bind then release a port so nothing is listening on it.
    const server = createTcpServer();
    await listen(server, 0);
    const { port } = server.address() as AddressInfo;
    await close(server);

    const result = await waitForWebserverExecutor(
      { servers: [{ port }], timeout: 300 },
      context
    );

    expect(result).toEqual({ success: false });
  });

  it('fails when a server defines neither a port nor a url', async () => {
    const result = await waitForWebserverExecutor(
      { servers: [{}], timeout: 300 },
      context
    );

    expect(result).toEqual({ success: false });
  });
});

function listen(
  server: Server | ReturnType<typeof createTcpServer>,
  port: number
): Promise<void> {
  return new Promise<void>((resolve) =>
    server.listen(port, '127.0.0.1', () => resolve())
  );
}

function close(
  server: Server | ReturnType<typeof createTcpServer>
): Promise<void> {
  return new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
}
