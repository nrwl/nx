import { createServer as createHttpServer, type Server } from 'node:http';
import * as https from 'node:https';
import { createServer as createTcpServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { logger, type ExecutorContext } from '@nx/devkit';
import waitForWebserverExecutor from './wait-for-webserver.impl';

// Replaces the module registry entry rather than spying on the namespace, which
// the transpiler copies per importer. The spy calls through, so a test can read
// what the request became on the wire instead of only what it was asked for.
jest.mock('node:https', () => {
  const actual = jest.requireActual('node:https');
  return { ...actual, request: jest.fn(actual.request) };
});

const context = {} as ExecutorContext;

type AnyServer = Server | ReturnType<typeof createTcpServer>;
const openServers = new Set<AnyServer>();

describe('waitForWebserverExecutor', () => {
  let errorSpy: jest.SpyInstance;
  let savedProxyEnv: Record<string, string | undefined>;

  beforeEach(() => {
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    // Every url probe reads these now, so a developer with a proxy configured
    // would otherwise have loopback probes routed at it for the whole file.
    savedProxyEnv = {};
    for (const name of PROXY_VARS) {
      savedProxyEnv[name] = process.env[name];
      delete process.env[name];
    }
  });

  afterEach(async () => {
    errorSpy.mockRestore();
    for (const [name, value] of Object.entries(savedProxyEnv)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    // Closing at the end of a test would be skipped by a failing assertion,
    // leaving a listening handle behind for the rest of the worker's life.
    await Promise.all(
      [...openServers].map((server) => close(server).catch(() => {}))
    );
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
      expect.stringContaining('times without resolving')
    );
  });

  it('follows a redirect chain past ten hops, like Playwright', async () => {
    const server = createHttpServer((req, res) => {
      const hop = Number(req.url.slice(1)) || 0;
      if (hop < 15) {
        res.statusCode = 302;
        res.setHeader('location', `/${hop + 1}`);
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
  });

  it('does not treat a redirect to an unparseable location as ready', async () => {
    const server = createHttpServer((_req, res) => {
      res.statusCode = 302;
      // Node's parser accepts the C1 controls in a header value, and this one
      // opens an escape sequence on the terminal the message is read on.
      res.setHeader('location', 'http://[\u009b31mred');
      res.end();
    });
    await listen(server, 0);
    const { port } = server.address() as AddressInfo;

    const result = await waitForWebserverExecutor(
      { servers: [{ url: `http://127.0.0.1:${port}` }], timeout: 300 },
      context
    );

    expect(result).toEqual({ success: false });
    const [message] = errorSpy.mock.calls[0];
    expect(message).toContain(
      'redirected to an invalid location "http://[31mred"'
    );
    expect(message).not.toContain('\u009b');
  });

  it('reports how far a redirect chain got when a hop fails to connect', async () => {
    const deadPort = await closedPort();
    const server = createHttpServer((_req, res) => {
      res.statusCode = 302;
      res.setHeader('location', `http://127.0.0.1:${deadPort}/`);
      res.end();
    });
    await listen(server, 0);
    const { port } = server.address() as AddressInfo;

    const result = await waitForWebserverExecutor(
      { servers: [{ url: `http://127.0.0.1:${port}` }], timeout: 300 },
      context
    );

    // Without the hop count this reads as the configured server refusing
    // connections, which is the one thing it is known not to be doing.
    expect(result).toEqual({ success: false });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('ECONNREFUSED after 1 redirects')
    );
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

    // Room for at least one full request/response, otherwise the wait ends
    // without ever observing the status it is meant to report.
    await waitForWebserverExecutor(
      { servers: [{ url: `http://127.0.0.1:${port}` }], timeout: 1000 },
      context
    );

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('responded with status 503')
    );
  });

  it('keeps the observed status when a later probe is cut short before it can learn anything', async () => {
    let responses = 0;
    const server = createHttpServer((_req, res) => {
      // Only the first request is answered. The next one is still waiting when
      // the deadline arrives, too early to call the server unresponsive.
      if (responses++ === 0) {
        res.statusCode = 503;
        res.end();
      }
    });
    await listen(server, 0);
    const { port } = server.address() as AddressInfo;

    await waitForWebserverExecutor(
      { servers: [{ url: `http://127.0.0.1:${port}` }], timeout: 500 },
      context
    );

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('responded with status 503')
    );
  });

  it('reports a server that answers nothing rather than an earlier failure it has moved past', async () => {
    // Bind and release a port so the first probe is refused, then listen on
    // it with a handler that never answers.
    const placeholder = createTcpServer();
    await listen(placeholder, 0);
    const { port } = placeholder.address() as AddressInfo;
    await close(placeholder);
    const server = createHttpServer(() => {});
    const timer = setTimeout(
      () => void listen(server, port).catch(() => {}),
      50
    );

    await waitForWebserverExecutor(
      { servers: [{ url: `http://127.0.0.1:${port}` }], timeout: 2000 },
      context
    );

    clearTimeout(timer);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('did not respond')
    );
    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('ECONNREFUSED')
    );
  }, 10000);

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

  it.each([NaN, -1, 0, 65536, 1.5])(
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
      const timer = setTimeout(
        () => void listen(server, port).catch(() => {}),
        300
      );

      const result = await waitForWebserverExecutor(
        level === 'the server'
          ? { servers: [{ port, timeout: 0 }] }
          : { servers: [{ port }], timeout: 0 },
        context
      );

      expect(result).toEqual({ success: true });
      clearTimeout(timer);
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
      const port = await closedPort();

      const result = await waitForWebserverExecutor(
        {
          servers: [{ url: `https://127.0.0.1:${port}`, ignoreHTTPSErrors }],
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
      request.mockClear();
    }
  );

  describe('with a proxy configured', () => {
    // The origin answers 503 and the proxy answers 200, so the result alone
    // says which route the probe took.
    async function startSplitRoutes() {
      const origin = createHttpServer((_req, res) => {
        res.statusCode = 503;
        res.end();
      });
      await listen(origin, 0);

      const forwarded: string[] = [];
      const proxy = createHttpServer((req, res) => {
        forwarded.push(req.url);
        res.statusCode = 200;
        res.end();
      });
      await listen(proxy, 0);

      return {
        forwarded,
        originUrl: `http://127.0.0.1:${(origin.address() as AddressInfo).port}`,
        proxyUrl: `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`,
      };
    }

    it('polls an http url through the proxy instead of directly', async () => {
      const { forwarded, originUrl, proxyUrl } = await startSplitRoutes();
      process.env.HTTP_PROXY = proxyUrl;

      const result = await waitForWebserverExecutor(
        { servers: [{ url: originUrl }], timeout: 2000 },
        context
      );

      expect(result).toEqual({ success: true });
      // An absolute-form target is what a proxy is given, so this also proves
      // the request was not simply sent to the origin.
      expect(forwarded).toEqual([`${originUrl}/`]);
    });

    it('goes direct when no_proxy covers the host', async () => {
      const { forwarded, originUrl, proxyUrl } = await startSplitRoutes();
      process.env.HTTP_PROXY = proxyUrl;
      process.env.NO_PROXY = '127.0.0.1';

      const result = await waitForWebserverExecutor(
        { servers: [{ url: originUrl }], timeout: 300 },
        context
      );

      expect(result).toEqual({ success: false });
      expect(forwarded).toEqual([]);
    });

    it('fails rather than falling back to a direct request when the proxy is unreachable', async () => {
      const ready = createHttpServer((_req, res) => {
        res.statusCode = 200;
        res.end();
      });
      await listen(ready, 0);
      const url = `http://127.0.0.1:${(ready.address() as AddressInfo).port}`;
      process.env.HTTP_PROXY = 'http://127.0.0.1:1';

      const result = await waitForWebserverExecutor(
        { servers: [{ url }], timeout: 300 },
        context
      );

      expect(result).toEqual({ success: false });
    });

    // Answers the tunnel request and then nothing, which is as far as a probe
    // can get without a certificate for the origin behind it.
    async function startTunnellingProxy(answer = true) {
      const tunnelled: string[] = [];
      const credentials: Array<string | undefined> = [];
      // Nothing on this side of the tunnel owns these, and the proxy cannot
      // finish closing while they are open.
      const tunnels: Array<{ destroy: () => void }> = [];
      const proxy = createHttpServer();
      proxy.on('connect', (req, socket) => {
        tunnelled.push(req.url);
        credentials.push(req.headers['proxy-authorization']);
        tunnels.push(socket);
        if (answer) {
          socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        }
      });
      await listen(proxy, 0);

      return {
        tunnelled,
        credentials,
        release: () => tunnels.forEach((tunnel) => tunnel.destroy()),
        proxyUrl: `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`,
      };
    }

    it('tunnels an https url through the proxy and addresses the origin', async () => {
      const { tunnelled, release, proxyUrl } = await startTunnellingProxy();
      process.env.HTTPS_PROXY = proxyUrl;
      const request = https.request as unknown as jest.Mock;

      const result = await waitForWebserverExecutor(
        { servers: [{ url: 'https://example.test:8443' }], timeout: 300 },
        context
      );
      release();

      expect(result).toEqual({ success: false });
      expect(tunnelled).toContain('example.test:8443');
      // A tunnelled request has to name the origin rather than the proxy it
      // travelled through. Reading the header back off the request is what
      // separates that from merely intending to.
      expect(request.mock.results[0].value.getHeader('host')).toBe(
        'example.test:8443'
      );
      request.mockClear();
    });

    it('tunnels to a host given as an ip address', async () => {
      const { tunnelled, release, proxyUrl } = await startTunnellingProxy();
      process.env.HTTPS_PROXY = proxyUrl;

      const result = await waitForWebserverExecutor(
        { servers: [{ url: 'https://127.0.0.1:8443' }], timeout: 300 },
        context
      );
      release();

      // An ip address is not a valid TLS server name, and the agent leaves it
      // off rather than failing over it, so the tunnel is asked for the same
      // way as one to a host name. Nothing answers behind it, so the probe ends
      // on the readiness budget.
      expect(tunnelled).toContain('127.0.0.1:8443');
      expect(result).toEqual({ success: false });
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Timed out after 300ms')
      );
    });

    it('sends proxy credentials on the tunnel request', async () => {
      const { credentials, release, proxyUrl } = await startTunnellingProxy();
      process.env.HTTPS_PROXY = proxyUrl.replace(
        'http://',
        'http://user:pa%3Ass@'
      );

      await waitForWebserverExecutor(
        { servers: [{ url: 'https://example.test:8443' }], timeout: 300 },
        context
      );
      release();

      // Decoded before they are encoded again, so a credential containing a
      // reserved character survives the round trip.
      expect(credentials[0]).toBe(
        `Basic ${Buffer.from('user:pa:ss').toString('base64')}`
      );
    });

    it('sends proxy credentials on an absolute-form request', async () => {
      const seen: Array<string | undefined> = [];
      const proxy = createHttpServer((req, res) => {
        seen.push(req.headers.authorization);
        res.statusCode = 200;
        res.end();
      });
      await listen(proxy, 0);
      const { port } = proxy.address() as AddressInfo;
      process.env.HTTP_PROXY = `http://user:pa%3Ass@127.0.0.1:${port}`;

      const result = await waitForWebserverExecutor(
        { servers: [{ url: 'http://example.test:4200' }], timeout: 300 },
        context
      );

      // Playwright hands the proxy url straight to `http.request`, so Node
      // derives the header from its userinfo and names it `Authorization`.
      expect(result).toEqual({ success: true });
      expect(seen[0]).toBe(
        `Basic ${Buffer.from('user:pa:ss').toString('base64')}`
      );
    });

    it('gives up on a proxy that accepts the connection and never answers', async () => {
      const { release, proxyUrl } = await startTunnellingProxy(false);
      process.env.HTTPS_PROXY = proxyUrl;
      const request = https.request as unknown as jest.Mock;

      const result = await waitForWebserverExecutor(
        { servers: [{ url: 'https://example.test:8443' }], timeout: 300 },
        context
      );
      const { agent } = request.mock.calls[0][1];
      release();

      // A request still waiting on the tunnel holds no socket to time itself
      // out on, so the wait has to end from the outside. Destroying the request
      // cannot reach the connection the agent opened either, since the agent
      // keeps it private until `CONNECT` returns, so aborting the signal the
      // agent was given is what closes it.
      expect(result).toEqual({ success: false });
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Timed out after 300ms')
      );
      expect(agent.connectOpts.signal.aborted).toBe(true);
      request.mockClear();
    });

    it('names the proxy when it is the one refusing the connection', async () => {
      const ready = createHttpServer((_req, res) => {
        res.statusCode = 200;
        res.end();
      });
      await listen(ready, 0);
      const url = `http://127.0.0.1:${(ready.address() as AddressInfo).port}`;
      process.env.HTTP_PROXY = 'http://127.0.0.1:1';

      await waitForWebserverExecutor(
        { servers: [{ url }], timeout: 300 },
        context
      );

      // The server here is up and serving, so blaming it would send whoever
      // reads this looking in the wrong place.
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('ECONNREFUSED via the proxy at 127.0.0.1:1')
      );
    });

    it('names the proxy when it answers instead of the server', async () => {
      const proxy = createHttpServer((_req, res) => {
        res.statusCode = 407;
        res.setHeader('proxy-authenticate', 'Basic realm="corp"');
        res.end();
      });
      await listen(proxy, 0);
      const { port } = proxy.address() as AddressInfo;
      process.env.HTTP_PROXY = `http://127.0.0.1:${port}`;

      await waitForWebserverExecutor(
        { servers: [{ url: 'http://example.test:4200' }], timeout: 300 },
        context
      );

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `responded with status 407 via the proxy at 127.0.0.1:${port}`
        )
      );
    });

    it('names the proxy when a redirect through it cannot be followed', async () => {
      const proxy = createHttpServer((_req, res) => {
        res.statusCode = 302;
        res.setHeader('location', 'http://');
        res.end();
      });
      await listen(proxy, 0);
      const { port } = proxy.address() as AddressInfo;
      process.env.HTTP_PROXY = `http://127.0.0.1:${port}`;

      await waitForWebserverExecutor(
        { servers: [{ url: 'http://example.test:4200' }], timeout: 300 },
        context
      );

      // The redirect came from the proxy, so the server named in the config had
      // no part in it.
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `redirected to an invalid location "http://" via the proxy at 127.0.0.1:${port}`
        )
      );
    });

    it('rejects a proxy url it cannot use instead of waiting on the server', async () => {
      process.env.HTTP_PROXY = 'http://user:100%@corp:8080';

      const result = await waitForWebserverExecutor(
        { servers: [{ url: 'http://127.0.0.1:4200' }], timeout: 30000 },
        context
      );

      expect(result).toEqual({ success: false });
      const [message] = errorSpy.mock.calls[0];
      // Naming the variable is what makes it findable among the eight that are
      // read; the timeout wording would mean the value was retried instead.
      expect(message).toContain(
        'cannot use the proxy configured in HTTP_PROXY: ***@corp:8080 has credentials that are not valid percent-encoding'
      );
      expect(message).not.toContain('Timed out');
      expect(message).not.toContain('100%');
    });

    it('rejects a proxy scheme neither request can be sent over', async () => {
      process.env.HTTP_PROXY = 'socks5://127.0.0.1:1080';

      const result = await waitForWebserverExecutor(
        { servers: [{ url: 'http://127.0.0.1:4200' }], timeout: 30000 },
        context
      );

      // Left to run, this throws out of `http.request` with a message naming
      // neither the server nor the variable that caused it.
      expect(result).toEqual({ success: false });
      // Matched whole: a message worded as a timeout would mean the value was
      // retried for 30 seconds first, and the wait appends the sentence's own
      // full stop.
      expect(errorSpy.mock.calls[0][0]).toBe(
        '@nx/playwright:wait-for-webserver cannot use the proxy configured in HTTP_PROXY: socks5://127.0.0.1:1080 is not an http or https url.'
      );
    });
  });
});

const PROXY_VARS = [
  'http_proxy',
  'HTTP_PROXY',
  'https_proxy',
  'HTTPS_PROXY',
  'all_proxy',
  'ALL_PROXY',
  'no_proxy',
  'NO_PROXY',
];

function listen(server: AnyServer, port: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // A released port can be taken again before a test re-listens on it, which
    // would otherwise surface as an uncaught EADDRINUSE and kill the worker.
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      openServers.add(server);
      resolve();
    });
  });
}

// Bound and released rather than picked, so the probe cannot land on whatever
// the developer running the suite happens to have listening.
async function closedPort(): Promise<number> {
  const server = createTcpServer();
  await listen(server, 0);
  const { port } = server.address() as AddressInfo;
  await close(server);
  return port;
}

function close(server: AnyServer): Promise<void> {
  openServers.delete(server);
  return new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
}
