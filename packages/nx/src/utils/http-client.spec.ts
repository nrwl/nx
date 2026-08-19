import { Agent, createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { createHttpClient, HttpError, httpRequest } from './http-client';

describe('httpRequest', () => {
  let server: Server;
  let otherOriginServer: Server;
  let baseUrl: string;
  let otherOriginUrl: string;

  beforeAll(async () => {
    otherOriginServer = createServer((req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ headers: req.headers }));
    });
    await new Promise<void>((resolve) => otherOriginServer.listen(0, resolve));
    otherOriginUrl = `http://localhost:${
      (otherOriginServer.address() as AddressInfo).port
    }`;
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
        } else if (req.url.startsWith('/redirect-bad-location')) {
          res.statusCode = 302;
          res.setHeader('location', 'http://[invalid');
          res.end();
        } else if (req.url.startsWith('/redirect-cross-origin')) {
          res.statusCode = 302;
          res.setHeader('location', `${otherOriginUrl}/echo`);
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
    otherOriginServer.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => otherOriginServer.close(resolve));
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

  describe('agent support (nxCloudProxyConfig)', () => {
    it('should route requests through node:http when an agent is provided', async () => {
      const agent = new Agent();
      const response = await httpRequest(`${baseUrl}/echo`, {
        method: 'POST',
        httpAgent: agent,
        data: { via: 'agent' },
      });
      expect(response.status).toBe(200);
      expect(response.data.body).toEqual({ via: 'agent' });
      agent.destroy();
    });

    it('should follow redirects and normalize error shapes on the node transport', async () => {
      const agent = new Agent();
      const redirected = await httpRequest(`${baseUrl}/redirect`, {
        httpAgent: agent,
      });
      expect(redirected.data.url).toBe('/echo');

      const error: HttpError = await httpRequest(`${baseUrl}/not-found`, {
        httpAgent: agent,
      }).catch((e) => e);
      expect(error).toBeInstanceOf(HttpError);
      expect(error.response.status).toBe(404);
      expect(error.response.data).toEqual({ message: 'nope' });
      agent.destroy();
    });

    it('should keep credentials on same-origin redirects but strip them cross-origin', async () => {
      const agent = new Agent();
      const sameOrigin = await httpRequest(`${baseUrl}/redirect`, {
        httpAgent: agent,
        headers: { authorization: 'secret', 'x-safe': 'kept' },
      });
      expect(sameOrigin.data.headers['authorization']).toBe('secret');

      const crossOrigin = await httpRequest(
        `${baseUrl}/redirect-cross-origin`,
        {
          httpAgent: agent,
          headers: { authorization: 'secret', 'x-safe': 'kept' },
        }
      );
      expect(crossOrigin.data.headers['authorization']).toBeUndefined();
      expect(crossOrigin.data.headers['x-safe']).toBe('kept');
      agent.destroy();
    });

    it('should reject a malformed location header instead of crashing', async () => {
      const agent = new Agent();
      await expect(
        httpRequest(`${baseUrl}/redirect-bad-location`, { httpAgent: agent })
      ).rejects.toThrow();
      agent.destroy();
    });

    it('should reject a redirect status without a location header', async () => {
      const agent = new Agent();
      const error: HttpError = await httpRequest(
        `${baseUrl}/redirect-no-location`,
        { httpAgent: agent }
      ).catch((e) => e);
      expect(error).toBeInstanceOf(HttpError);
      expect(error.status).toBe(302);
      agent.destroy();
    });
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
