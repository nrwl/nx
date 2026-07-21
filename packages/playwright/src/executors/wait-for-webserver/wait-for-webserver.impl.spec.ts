import { EventEmitter } from 'node:events';
import { createServer as createHttpServer, type Server } from 'node:http';
import * as https from 'node:https';
import { createServer as createTcpServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { logger, type ExecutorContext } from '@nx/devkit';
import waitForWebserverExecutor from './wait-for-webserver.impl';

// Replaces the module registry entry rather than spying on the namespace, which
// the transpiler copies per importer.
jest.mock('node:https', () => ({
  ...jest.requireActual('node:https'),
  request: jest.fn(),
}));

const context = {} as ExecutorContext;

describe('waitForWebserverExecutor', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

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
    const requested: string[] = [];
    const server = createHttpServer((req, res) => {
      requested.push(req.url);
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
    // The 302 alone already sits inside the ready window, so only the request
    // to the destination proves the chain was actually followed.
    expect(requested).toEqual(['/', '/ready']);
    await close(server);
  });

  it('does not treat an endless redirect loop as ready', async () => {
    let hops = 0;
    const server = createHttpServer((_req, res) => {
      res.statusCode = 302;
      res.setHeader('location', `/hop-${++hops}`);
      res.end();
    });
    await listen(server, 0);
    const { port } = server.address() as AddressInfo;

    const result = await waitForWebserverExecutor(
      { servers: [{ url: `http://127.0.0.1:${port}` }], timeout: 300 },
      context
    );

    expect(result).toEqual({ success: false });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('redirected more than')
    );
    await close(server);
  });

  it('does not treat a redirect to an unparseable location as ready', async () => {
    const server = createHttpServer((_req, res) => {
      res.statusCode = 302;
      res.setHeader('location', 'http://');
      res.end();
    });
    await listen(server, 0);
    const { port } = server.address() as AddressInfo;

    const result = await waitForWebserverExecutor(
      { servers: [{ url: `http://127.0.0.1:${port}` }], timeout: 300 },
      context
    );

    expect(result).toEqual({ success: false });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('redirected to an invalid location')
    );
    await close(server);
  });

  it('waits for every configured server, not just the first', async () => {
    const ready = createTcpServer();
    await listen(ready, 0);
    const readyPort = (ready.address() as AddressInfo).port;
    const slow = createTcpServer();
    await listen(slow, 0);
    const slowPort = (slow.address() as AddressInfo).port;
    await close(slow);

    const result = await waitForWebserverExecutor(
      {
        servers: [{ port: readyPort }, { port: slowPort }],
        timeout: 300,
      },
      context
    );

    expect(result).toEqual({ success: false });
    await close(ready);
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

  it('fails immediately when a url cannot be parsed rather than retrying it', async () => {
    const start = Date.now();

    // no timeout, so retrying a url that can never become valid would block
    // for the full default budget.
    const result = await waitForWebserverExecutor(
      { servers: [{ url: 'http://' }] },
      context
    );

    expect(result).toEqual({ success: false });
    expect(Date.now() - start).toBeLessThan(1000);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('invalid "url": http://')
    );
  });

  it('reports the status the url responded with when the wait times out', async () => {
    const server = createHttpServer((_req, res) => {
      res.statusCode = 503;
      res.end();
    });
    await listen(server, 0);
    const { port } = server.address() as AddressInfo;

    await waitForWebserverExecutor(
      { servers: [{ url: `http://127.0.0.1:${port}` }], timeout: 300 },
      context
    );

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('responded with status 503')
    );
    await close(server);
  });

  it('reports the connection error when a port never accepts connections', async () => {
    const server = createTcpServer();
    await listen(server, 0);
    const { port } = server.address() as AddressInfo;
    await close(server);

    await waitForWebserverExecutor(
      { servers: [{ port }], timeout: 300 },
      context
    );

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('ECONNREFUSED')
    );
  });

  it('bounds each server by its own timeout', async () => {
    const server = createTcpServer();
    await listen(server, 0);
    const { port } = server.address() as AddressInfo;
    await close(server);
    const start = Date.now();

    const result = await waitForWebserverExecutor(
      { servers: [{ port, timeout: 300 }] },
      context
    );

    expect(result).toEqual({ success: false });
    expect(Date.now() - start).toBeLessThan(3000);
  });

  it('lets the executor timeout override a per-server timeout', async () => {
    const server = createTcpServer();
    await listen(server, 0);
    const { port } = server.address() as AddressInfo;
    await close(server);
    const start = Date.now();

    const result = await waitForWebserverExecutor(
      { servers: [{ port, timeout: 60_000 }], timeout: 300 },
      context
    );

    expect(result).toEqual({ success: false });
    expect(Date.now() - start).toBeLessThan(3000);
  });

  it.each([NaN, -1, 65536, 1.5])(
    'fails immediately when the port (%p) cannot be connected to rather than retrying it',
    async (port) => {
      const start = Date.now();

      // no timeout, so retrying a port that can never be valid would block for
      // the full default budget.
      const result = await waitForWebserverExecutor(
        { servers: [{ port }] },
        context
      );

      expect(result).toEqual({ success: false });
      expect(Date.now() - start).toBeLessThan(1000);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`invalid "port": ${port}`)
      );
    }
  );

  it('fails when there is no server to wait for', async () => {
    const result = await waitForWebserverExecutor({ servers: [] }, context);

    expect(result).toEqual({ success: false });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('at least one server')
    );
  });

  it.each(['the server', 'the executor'])(
    'treats a timeout of 0 on %s as unset, like Playwright',
    async (level) => {
      const server = createTcpServer();
      await listen(server, 0);
      const { port } = server.address() as AddressInfo;
      await close(server);
      // Comes up after the first probe has already failed, so a 0 read as
      // "give up immediately" would never see it.
      const timer = setTimeout(() => void listen(server, port), 300);

      const result = await waitForWebserverExecutor(
        level === 'the server'
          ? { servers: [{ port, timeout: 0 }] }
          : { servers: [{ port }], timeout: 0 },
        context
      );

      expect(result).toEqual({ success: true });
      clearTimeout(timer);
      await close(server);
    },
    10000
  );

  it.each([
    { ignoreHTTPSErrors: true, rejectUnauthorized: false },
    { ignoreHTTPSErrors: false, rejectUnauthorized: true },
  ])(
    'polls https urls with ignoreHTTPSErrors $ignoreHTTPSErrors',
    async ({ ignoreHTTPSErrors, rejectUnauthorized }) => {
      const request = https.request as unknown as jest.Mock;
      request.mockImplementation(unreachableRequest);

      const result = await waitForWebserverExecutor(
        {
          servers: [{ url: 'https://127.0.0.1:9999', ignoreHTTPSErrors }],
          timeout: 300,
        },
        context
      );

      expect(result).toEqual({ success: false });
      expect(request).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ rejectUnauthorized }),
        expect.any(Function)
      );
      request.mockReset();
    }
  );
});

// Stands in for an https endpoint that refuses connections, so the TLS options
// the executor builds can be asserted without a certificate.
function unreachableRequest(): any {
  const request = new EventEmitter() as any;
  request.destroy = () => {};
  request.end = () =>
    setImmediate(() =>
      request.emit(
        'error',
        Object.assign(new Error('connect ECONNREFUSED'), {
          code: 'ECONNREFUSED',
        })
      )
    );

  return request;
}

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
