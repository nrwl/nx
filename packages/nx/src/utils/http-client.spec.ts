import { createServer, Server } from 'http';
import { AddressInfo, connect, Socket } from 'net';
import { createHttpClient, HttpError, httpRequest } from './http-client';

describe('httpRequest', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        if (req.url.startsWith('/echo')) {
          res.setHeader('content-type', 'application/json');
          res.end(
            JSON.stringify({
              method: req.method,
              url: req.url,
              headers: req.headers,
              body: body ? JSON.parse(body) : null,
            })
          );
        } else if (req.url.startsWith('/text')) {
          res.end('plain text response');
        } else if (req.url.startsWith('/not-found')) {
          res.statusCode = 404;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ message: 'nope' }));
        } else if (req.url.startsWith('/slow')) {
          setTimeout(() => res.end('{}'), 5_000).unref();
        } else if (req.url.startsWith('/redirect-no-location')) {
          res.statusCode = 302;
          res.end();
        } else if (req.url.startsWith('/redirect')) {
          res.statusCode = 302;
          res.setHeader('location', '/echo');
          res.end();
        } else if (req.url.startsWith('/stall')) {
          res.write('first chunk then silence');
        } else {
          res.statusCode = 500;
          res.end('unexpected');
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  it('should send JSON bodies, custom headers and query params', async () => {
    const response = await httpRequest(`${baseUrl}/echo`, {
      method: 'POST',
      headers: { 'x-custom': 'yes' },
      params: { a: 1, b: 'two', skipped: null, alsoSkipped: undefined },
      data: { hello: 'world' },
    });

    expect(response.status).toBe(200);
    expect(response.data.method).toBe('POST');
    expect(response.data.url).toBe('/echo?a=1&b=two');
    expect(response.data.headers['x-custom']).toBe('yes');
    expect(response.data.headers['content-type']).toBe('application/json');
    expect(response.data.body).toEqual({ hello: 'world' });
  });

  it('should return non-JSON responses as text', async () => {
    const response = await httpRequest(`${baseUrl}/text`);
    expect(response.data).toBe('plain text response');
  });

  it('should throw an HttpError with the axios-compatible shape on error statuses', async () => {
    await expect(httpRequest(`${baseUrl}/not-found`)).rejects.toThrow(
      'Request failed with status code 404'
    );

    const error: HttpError = await httpRequest(`${baseUrl}/not-found`).catch(
      (e) => e
    );
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(404);
    expect(error.response.status).toBe(404);
    expect(error.response.data).toEqual({ message: 'nope' });
  });

  it('should abort when the timeout elapses', async () => {
    await expect(
      httpRequest(`${baseUrl}/slow`, { timeout: 100 })
    ).rejects.toThrow();
  });

  it('should return a readable stream for responseType stream', async () => {
    const response = await httpRequest(`${baseUrl}/text`, {
      responseType: 'stream',
    });

    const chunks: Buffer[] = [];
    for await (const chunk of response.data) {
      chunks.push(chunk);
    }
    expect(Buffer.concat(chunks).toString()).toBe('plain text response');
  });

  it('should follow redirects', async () => {
    const response = await httpRequest(`${baseUrl}/redirect`);
    expect(response.data.url).toBe('/echo');
  });

  it('should reject a redirect status without a location header', async () => {
    const error: HttpError = await httpRequest(
      `${baseUrl}/redirect-no-location`
    ).catch((e) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(302);
  });

  it('should abort a stalled stream body after the inactivity timeout', async () => {
    const response = await httpRequest(`${baseUrl}/stall`, {
      responseType: 'stream',
      timeout: 200,
    });

    await expect(
      (async () => {
        for await (const _ of response.data) {
          // consume until the stall guard destroys the stream
        }
      })()
    ).rejects.toThrow('Response stalled for 200ms');
  });

  describe('proxy environment variables', () => {
    const proxyVariables = [
      'HTTP_PROXY',
      'http_proxy',
      'HTTPS_PROXY',
      'https_proxy',
      'ALL_PROXY',
      'all_proxy',
      'NO_PROXY',
      'no_proxy',
    ];
    let proxy: Server;
    let proxyUrl: string;
    let sockets: Set<Socket>;
    let destinations: string[];

    beforeEach(async () => {
      vi.resetModules();
      for (const variable of proxyVariables) vi.stubEnv(variable, '');
      sockets = new Set();
      destinations = [];
      proxy = createServer();
      proxy.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
      });
      proxy.on('connect', (req, socket, head) => {
        destinations.push(req.url);
        if (req.url.endsWith(':443')) {
          // Reject after CONNECT so HTTPS routing needs no test certificate.
          socket.end('HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n');
          return;
        }
        const upstream = connect(
          (server.address() as AddressInfo).port,
          'localhost'
        );
        sockets.add(upstream);
        upstream.on('close', () => sockets.delete(upstream));
        upstream.on('error', () => socket.destroy());
        socket.on('error', () => upstream.destroy());
        socket.on('close', () => upstream.destroy());
        upstream.on('connect', () => {
          socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          upstream.write(head);
          socket.pipe(upstream).pipe(socket);
        });
      });
      await new Promise<void>((resolve) =>
        proxy.listen(0, '127.0.0.1', resolve)
      );
      proxyUrl = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`;
    });

    afterEach(async () => {
      vi.unstubAllEnvs();
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => proxy.close(() => resolve()));
      vi.resetModules();
    });

    it.each([
      ['http', 'ALL_PROXY', []],
      ['http', 'all_proxy', ['ALL_PROXY']],
      ['http', 'HTTP_PROXY', ['ALL_PROXY', 'all_proxy', 'HTTPS_PROXY']],
      ['http', 'http_proxy', ['ALL_PROXY', 'all_proxy', 'HTTP_PROXY']],
      ['https', 'ALL_PROXY', []],
      ['https', 'all_proxy', ['ALL_PROXY']],
      ['https', 'HTTPS_PROXY', ['ALL_PROXY', 'all_proxy', 'HTTP_PROXY']],
      ['https', 'https_proxy', ['ALL_PROXY', 'all_proxy', 'HTTPS_PROXY']],
    ] as const)(
      'routes %s through %s ahead of %j',
      async (protocol, winner, overridden) => {
        for (const variable of overridden)
          vi.stubEnv(variable, 'http://127.0.0.1:1');
        vi.stubEnv(winner, proxyUrl);
        const { httpRequest: request } = await import('./http-client');

        const response = request(`${protocol}://proxy-test.invalid/text`, {
          timeout: 2000,
        });
        if (protocol === 'http') {
          expect((await response).data).toBe('plain text response');
        } else {
          await expect(response).rejects.toThrow();
        }
        expect(destinations).toEqual([
          `proxy-test.invalid:${protocol === 'http' ? 80 : 443}`,
        ]);
      }
    );
  });

  describe('createHttpClient', () => {
    it('should preserve a path prefix in the baseURL', async () => {
      const client = createHttpClient({ baseURL: `${baseUrl}/echo` });
      const response = await client.get('/sub-path');
      expect(response.data.url).toBe('/echo/sub-path');
    });

    it('should merge default and per-request headers', async () => {
      const client = createHttpClient({
        baseURL: baseUrl,
        headers: { 'x-default': 'a', 'x-overridden': 'a' },
      });
      const response = await client.post(
        '/echo',
        { some: 'data' },
        { headers: { 'x-overridden': 'b' } }
      );
      expect(response.data.headers['x-default']).toBe('a');
      expect(response.data.headers['x-overridden']).toBe('b');
      expect(response.data.body).toEqual({ some: 'data' });
    });

    it('should merge differently-cased headers as overrides, not duplicates', async () => {
      const client = createHttpClient({
        baseURL: baseUrl,
        headers: { Authorization: 'default' },
      });
      const response = await client.get('/echo', {
        headers: { authorization: 'override' },
      });
      expect(response.data.headers['authorization']).toBe('override');
    });
  });
});
