import { emitReadySignal } from '@nx/devkit';
import { getListeningUrl } from '@nx/devkit/internal';
import { type Configuration, type DevServer, rspack } from '@rspack/core';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { _createConfig, createConfig } from '../config/create-config';
import type { AngularRspackPluginOptions } from '../models';

vi.mock('@nx/devkit', async (importOriginal) => ({
  ...(await importOriginal()),
  emitReadySignal: vi.fn(() => true),
}));
vi.mock('@nx/devkit/internal', async (importOriginal) => ({
  ...(await importOriginal()),
  getListeningUrl: vi.fn(() => 'https://localhost:4200/'),
}));

describe('NgRspackPlugin', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('reports the dev server address once it listens, in a config @nx/rspack/plugin infers a signal for', async () => {
    vi.stubEnv('NX_READY_SIGNAL_SOCKET', '/tmp/nx-ready.sock');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const [config] = await _createConfig({
      browser: './src/main.ts',
      index: './src/index.html',
      tsConfig: './tsconfig.base.json',
      outputPath: './dist',
      deleteOutputPath: false,
    });
    expect(
      config.plugins?.some(
        (plugin) => plugin?.[Symbol.for('@nx/ready-signal-plugin')]
      )
    ).toBe(true);

    const compiler = rspack(config);
    try {
      expect(emitReadySignal).not.toHaveBeenCalled();

      const address = { address: '::', family: 'IPv6', port: 4200 };
      const devServer = compiler.options.devServer || {};
      devServer.onListening?.({
        server: { address: () => address },
        options: { server: { type: 'https', options: {} } },
      });

      expect(log).toHaveBeenCalledWith('Listening on port:', 4200);
      expect(getListeningUrl).toHaveBeenCalledWith(address, true);
      expect(emitReadySignal).toHaveBeenCalledWith('https://localhost:4200/');
    } finally {
      await new Promise((resolve) => compiler.close(resolve));
    }
  });

  it.each([
    [
      'leaves the report to an SSR server that calls emitReadySignal',
      'emitReadySignal(server);',
      true,
      undefined,
      undefined,
      0,
    ],
    [
      'reports the dev server address when the SSR server does not',
      'app.listen(4000);',
      true,
      undefined,
      undefined,
      1,
    ],
    [
      'reports the dev server address when a missing server file leaves a browser-only build',
      'emitReadySignal(server);',
      false,
      undefined,
      undefined,
      1,
    ],
    [
      'reports the dev server address when a file replacement swaps in an SSR server that does not call emitReadySignal',
      'emitReadySignal(server);',
      true,
      'app.listen(4000);',
      undefined,
      1,
    ],
    [
      'leaves the report to an SSR server that a file replacement swaps in',
      'app.listen(4000);',
      true,
      'emitReadySignal(server);',
      undefined,
      0,
    ],
    [
      'reports the dev server address when the development configuration replaces the SSR server with one that does not call emitReadySignal',
      'app.listen(4000);',
      true,
      'emitReadySignal(server);',
      'app.listen(4000);',
      1,
    ],
  ])(
    '%s',
    async (
      _,
      serverSource,
      hasServerFile,
      replacementSource,
      developmentSource,
      reports
    ) => {
      vi.stubEnv('NX_READY_SIGNAL_SOCKET', '/tmp/nx-ready.sock');
      vi.stubEnv('RSPACK_SERVE', 'true');
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const root = await mkdtemp(join(tmpdir(), 'ng-rspack-ssr-'));
      try {
        await mkdir(join(root, 'src'), { recursive: true });
        if (hasServerFile) {
          await writeFile(join(root, 'src', 'main.server.ts'), '');
        }
        await writeFile(join(root, 'src', 'server.ts'), serverSource);
        if (replacementSource !== undefined) {
          await writeFile(
            join(root, 'src', 'server.replaced.ts'),
            replacementSource
          );
        }
        if (developmentSource !== undefined) {
          await writeFile(
            join(root, 'src', 'server.development.ts'),
            developmentSource
          );
        }
        const [config] = await createConfig(
          {
            options: {
              browser: './src/main.ts',
              index: './src/index.html',
              tsConfig: './tsconfig.base.json',
              outputPath: './dist',
              deleteOutputPath: false,
              root,
              server: './src/main.server.ts',
              ssr: { entry: './src/server.ts' },
              fileReplacements:
                replacementSource === undefined
                  ? []
                  : [
                      {
                        replace: './src/server.ts',
                        with: './src/server.replaced.ts',
                      },
                    ],
            },
          },
          developmentSource === undefined
            ? {}
            : {
                development: {
                  options: {
                    fileReplacements: [
                      {
                        replace: './src/server.ts',
                        with: './src/server.development.ts',
                      },
                    ],
                  },
                },
              }
        );

        const compiler = rspack(config);
        try {
          (compiler.options.devServer || {}).onListening?.({
            server: {
              address: () => ({ address: '::', family: 'IPv6', port: 4200 }),
            },
            options: { server: { type: 'http', options: {} } },
          });

          expect(emitReadySignal).toHaveBeenCalledTimes(reports);
        } finally {
          await new Promise((resolve) => compiler.close(resolve));
        }
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    10000
  );

  describe('dev server CORS', () => {
    type Middleware = ReturnType<
      NonNullable<DevServer['setupMiddlewares']>
    >[number];
    type Handler = (
      req: IncomingMessage,
      res: ServerResponse,
      next: () => void
    ) => void;

    const options: AngularRspackPluginOptions = {
      browser: './src/main.ts',
      index: './src/index.html',
      tsConfig: './tsconfig.base.json',
      outputPath: './dist',
      deleteOutputPath: false,
    };
    const ALLOW_ORIGIN = 'access-control-allow-origin';

    // Stand-ins for the dev server's own entries, in its order: `headers`,
    // the dev middleware, the proxy and the handler that ends OPTIONS requests.
    function devServerMiddlewares(headers: DevServer['headers']): Middleware[] {
      const setHeaders: Handler = (_, res, next) => {
        for (const [name, value] of Object.entries(headers ?? {})) {
          res.setHeader(name, value);
        }
        next();
      };
      const devMiddleware: Handler = (req, res, next) =>
        req.method === 'GET' && req.url === '/main.js' ? res.end() : next();
      const proxy: Handler = (req, res, next) =>
        req.url?.startsWith('/api') ? res.end('proxied') : next();
      const endOptions: Handler = (req, res, next) => {
        if (req.method !== 'OPTIONS') {
          return next();
        }
        res.statusCode = 204;
        res.end();
      };
      return [
        ...(headers === undefined
          ? []
          : [{ name: 'set-headers', middleware: setHeaders }]),
        { name: '@rspack/dev-middleware', middleware: devMiddleware },
        { name: 'http-proxy-middleware', middleware: proxy },
        { name: 'options-middleware', middleware: endOptions },
      ];
    }

    async function serve(config: Configuration) {
      const compiler = rspack(config);
      const devServer = compiler.options.devServer || {};
      const ownMiddlewares = devServerMiddlewares(devServer.headers);
      const middlewares =
        devServer.setupMiddlewares?.(ownMiddlewares, {}) ?? ownMiddlewares;
      const server = createServer((req, res) => {
        let index = 0;
        const next = () => {
          const entry = middlewares[index++];
          if (!entry) {
            res.statusCode = 404;
            res.end();
            return;
          }
          const handler =
            typeof entry === 'function' ? entry : entry.middleware;
          (handler as Handler)(req, res, next);
        };
        next();
      });
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve)
      );
      const { port } = server.address() as AddressInfo;
      return {
        send: (method: string, path: string, headers: Record<string, string>) =>
          fetch(`http://127.0.0.1:${port}${path}`, { method, headers }),
        close: async () => {
          await new Promise((resolve) => server.close(resolve));
          await new Promise((resolve) => compiler.close(resolve));
        },
      };
    }

    describe('by default', () => {
      let devServer: Awaited<ReturnType<typeof serve>>;
      beforeAll(async () => {
        devServer = await serve((await _createConfig(options))[0]);
      }, 10000);
      afterAll(() => devServer.close());

      it.each([
        ['a foreign origin', 'https://evil.example', null],
        [
          'a host that only starts with localhost',
          'http://localhost.evil.example',
          null,
        ],
        ['localhost', 'http://localhost:4000', 'http://localhost:4000'],
        [
          'a localhost subdomain',
          'https://app.localhost',
          'https://app.localhost',
        ],
        ['127.0.0.1', 'http://127.0.0.1:8080', 'http://127.0.0.1:8080'],
        ['[::1]', 'http://[::1]:3000', 'http://[::1]:3000'],
      ])('answers a request from %s', async (_, origin, allowed) => {
        const { headers } = await devServer.send('GET', '/main.js', {
          origin,
        });

        expect(headers.get(ALLOW_ORIGIN)).toBe(allowed);
        expect(headers.get('vary')).toBe('Origin');
      });

      it('answers a preflight request from localhost and lets the proxy forward it', async () => {
        const preflight = {
          origin: 'http://localhost:4000',
          'access-control-request-method': 'PUT',
          'access-control-request-headers': 'content-type,x-token',
        };

        const asset = await devServer.send('OPTIONS', '/main.js', preflight);
        expect(asset.status).toBe(204);
        expect(Object.fromEntries(asset.headers)).toMatchObject({
          [ALLOW_ORIGIN]: 'http://localhost:4000',
          'access-control-allow-methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
          'access-control-allow-headers': 'content-type,x-token',
          vary: 'Origin, Access-Control-Request-Headers',
        });

        const proxied = await devServer.send('OPTIONS', '/api/data', preflight);
        expect(await proxied.text()).toBe('proxied');
        expect(proxied.headers.get(ALLOW_ORIGIN)).toBe('http://localhost:4000');

        const foreign = await devServer.send('OPTIONS', '/main.js', {
          ...preflight,
          origin: 'https://evil.example',
        });
        expect(foreign.headers.get(ALLOW_ORIGIN)).toBeNull();
      });
    });

    const setCustomOrigin: Handler = (_, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', 'https://custom.example');
      next();
    };
    it.each<[string, Parameters<typeof createConfig>[0]]>([
      [
        'devServer.headers',
        {
          options: {
            ...options,
            devServer: {
              headers: {
                'Access-Control-Allow-Origin': 'https://custom.example',
              },
            },
          },
        },
      ],
      [
        'rspackConfigOverrides.devServer.headers',
        {
          options,
          rspackConfigOverrides: {
            devServer: {
              headers: {
                'access-control-allow-origin': 'https://custom.example',
              },
            },
          },
        },
      ],
      [
        'a middleware that setupMiddlewares puts first',
        {
          options,
          rspackConfigOverrides: {
            devServer: {
              setupMiddlewares: (middlewares) => [
                setCustomOrigin,
                ...middlewares,
              ],
            },
          },
        },
      ],
    ])(
      'keeps the allowed origin that %s sets',
      async (_, config) => {
        const devServer = await serve((await createConfig(config))[0]);
        try {
          const { headers } = await devServer.send('GET', '/main.js', {
            origin: 'http://localhost:4000',
          });

          expect(headers.get(ALLOW_ORIGIN)).toBe('https://custom.example');
        } finally {
          await devServer.close();
        }
      },
      10000
    );
  });
});
