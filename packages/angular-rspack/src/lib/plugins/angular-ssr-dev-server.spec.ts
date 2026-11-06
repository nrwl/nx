import {
  rspack,
  sources,
  type Compiler,
  type Configuration,
  type DevServerMiddleware,
  type DevServerMiddlewareHandler,
  type MultiCompiler,
} from '@rspack/core';
import { mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedAngularRspackPluginOptions } from '../models';
import { AngularSsrDevServer } from './angular-ssr-dev-server';
import { DevServerReloads } from './dev-server-reloads';

// vitest's module runner has no callback for the `import()` that
// loadEsmModule builds with `new Function`.
vi.mock('../utils/misc-helpers', async (importOriginal) => ({
  ...(await importOriginal()),
  loadEsmModule: (path: string | URL) => import(/* @vite-ignore */ `${path}`),
}));

// Resolves @angular/ssr/node and @angular/compiler for the fallback paths.
const packageRoot = resolve(__dirname, '../../..');

const nodeHandler = (body: string) => `
const handler = (req, res, next) => {
  if (req.url === '/next') {
    next();
    return;
  }
  res.end(JSON.stringify({ body: ${body}, url: req.url, originalUrl: req.originalUrl }));
};
handler.__ng_node_request_handler__ = true;
exports.reqHandler = handler;
`;

interface Harness {
  dir: string;
  url: string;
  ssrDevServer: AngularSsrDevServer | undefined;
  sendMessage: ReturnType<typeof vi.fn>;
  httpServer: Server;
  get(
    path: string
  ): Promise<{ status: number; body: string; location: string | null }>;
  /** Writes a source file and waits for the round it starts to end. */
  edit(file: string, content: string, onInvalid?: () => void): Promise<void>;
  /** Holds the next server build when it reaches emit, until `release`. */
  stallServerBuild(): { reached: Promise<void>; release(): void };
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  vi.restoreAllMocks();
  while (cleanups.length) {
    await cleanups.pop()?.();
  }
});

async function startHarness({
  server,
  ssr = true,
  servePath = '/',
  hot,
  liveReload,
  lazyCompilation = false,
  proxy = false,
}: {
  server?: string;
  ssr?: boolean;
  servePath?: string;
  hot?: boolean;
  liveReload?: boolean;
  lazyCompilation?: boolean;
  proxy?: boolean;
}): Promise<Harness> {
  const dir = await mkdtemp(join(tmpdir(), 'ngrs-ssr-dev-server-'));
  const browserOutput = join(dir, 'dist', 'browser');
  const serverOutput = join(dir, 'dist', 'server');
  await writeFile(join(dir, 'browser.js'), `console.log('PAGE-v1');\n`);
  await writeFile(join(dir, 'document.html'), '<p>v1</p>');
  await writeFile(join(dir, 'server.js'), server ?? nodeHandler("'v1'"));
  // Files newer than the watch start rebuild once more at startup.
  const past = new Date(Date.now() - 60_000);
  for (const file of ['browser.js', 'document.html', 'server.js']) {
    await utimes(join(dir, file), past, past);
  }

  const options = {
    root: packageRoot,
    outputPath: {
      base: join(dir, 'dist'),
      browser: browserOutput,
      server: serverOutput,
    },
    index: { input: 'document.html', output: 'index.html' },
    devServer: {},
  } as NormalizedAngularRspackPluginOptions;
  // Loading a bundle turns on Node source maps for the process.
  const sourceMaps = process.sourceMapsEnabled;
  const reloads = new DevServerReloads();
  const ssrDevServer = ssr
    ? new AngularSsrDevServer(options, reloads)
    : undefined;

  const browserConfig: Configuration = {
    name: 'browser',
    mode: 'development',
    context: dir,
    devtool: false,
    target: 'web',
    entry: './browser.js',
    output: { path: browserOutput },
    devServer: { devMiddleware: { publicPath: servePath }, hot, liveReload },
    ...(lazyCompilation ? { lazyCompilation: true } : {}),
    watchOptions: { aggregateTimeout: 5 },
    plugins: [
      // Emits a document at processAssets, as IndexHtmlPlugin does.
      (compiler: Compiler) => {
        compiler.hooks.thisCompilation.tap('test', (compilation) => {
          compilation.hooks.processAssets.tapPromise('test', async () => {
            const document = join(dir, 'document.html');
            compilation.fileDependencies.add(document);
            compilation.emitAsset(
              'index.html',
              new sources.RawSource(await readFile(document, 'utf-8'))
            );
            compilation.emitAsset(
              'shared.txt',
              new sources.RawSource('browser shared')
            );
          });
        });
      },
      (compiler: Compiler) => {
        ssrDevServer?.applyToBrowser(compiler);
        reloads.apply(compiler, { endsRound: !ssrDevServer });
      },
    ],
  };
  const serverConfig: Configuration = {
    name: 'server',
    dependencies: ['browser'],
    mode: 'development',
    context: dir,
    devtool: false,
    target: 'node',
    entry: { server: './server.js' },
    output: {
      path: serverOutput,
      filename: '[name].js',
      library: { type: 'commonjs' },
    },
    watchOptions: { aggregateTimeout: 5 },
    plugins: [
      (compiler: Compiler) => {
        compiler.hooks.thisCompilation.tap('test', (compilation) => {
          compilation.hooks.processAssets.tap('test', () => {
            compilation.emitAsset(
              'shared.txt',
              new sources.RawSource('server shared')
            );
          });
        });
        compiler.hooks.emit.tapPromise('test', async () => {
          serverStall?.reach();
          await serverStall?.released;
        });
        ssrDevServer?.applyToServer(compiler);
      },
    ],
  };

  let serverStall: { reach(): void; released: Promise<void> } | undefined;
  const compiler = rspack(
    ssrDevServer ? [browserConfig, serverConfig] : [browserConfig]
  ) as MultiCompiler;
  const [browser, serverCompiler] = compiler.compilers;
  const lastCompiler = serverCompiler ?? browser;

  let edited: string | undefined;
  let editSeen = false;
  let onEditInvalid: (() => void) | undefined;
  let editDone: (() => void) | undefined;
  for (const child of compiler.compilers) {
    child.hooks.invalid.tap('test', () => {
      const callback = onEditInvalid;
      onEditInvalid = undefined;
      callback?.();
    });
    child.hooks.watchRun.tap('test', (running) => {
      if (edited && running.modifiedFiles?.has(edited)) {
        editSeen = true;
      }
    });
  }
  lastCompiler.hooks.done.tap('test', () => {
    if (editSeen) {
      editSeen = false;
      edited = undefined;
      editDone?.();
    }
  });
  const firstRound = new Promise<void>((resolve) =>
    lastCompiler.hooks.done.tap('test', () => resolve())
  );

  const watching = compiler.watch({ aggregateTimeout: 5 }, () => {});

  const sendMessage = vi.fn();
  const base = servePath === '/' ? '' : servePath;
  // Answers the browser document, and the files of both compilations as
  // rspack 1.x's dev middleware does.
  const devMiddleware: DevServerMiddlewareHandler = async (req, res, next) => {
    if (req.url === `${base}/index.html`) {
      res.end('client document');
      return;
    }
    const name = req.url?.startsWith(`${base}/`)
      ? req.url.slice(base.length + 1)
      : undefined;
    for (const output of [browserOutput, serverOutput]) {
      const content =
        name && (await readFile(join(output, name), 'utf-8').catch(() => ''));
      if (content) {
        res.end(content);
        return;
      }
    }
    next();
  };
  // Both dev servers pass the dev middleware entry without its middleware,
  // and add it again after a proxy. After `setupMiddlewares` they create the
  // dev middleware for the entries that still have none.
  const devMiddlewareEntry = () =>
    ({
      name: '@rspack/dev-middleware',
      middleware: undefined,
    }) as unknown as DevServerMiddleware;
  const middlewares =
    (browser.options.devServer || {}).setupMiddlewares?.(
      proxy
        ? [
            devMiddlewareEntry(),
            {
              name: 'http-proxy-middleware',
              middleware: (_req, _res, next) => next(),
            },
            devMiddlewareEntry(),
          ]
        : [devMiddlewareEntry()],
      { webSocketServer: { clients: [{}] }, sendMessage }
    ) ?? [];
  for (const entry of middlewares) {
    if (
      typeof entry === 'object' &&
      entry.name === '@rspack/dev-middleware' &&
      entry.middleware === undefined
    ) {
      entry.middleware = devMiddleware;
    }
  }
  const httpServer: Server = createServer((req, res) =>
    runMiddlewares(middlewares, req, res)
  );
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));

  cleanups.push(async () => {
    httpServer.closeAllConnections();
    await new Promise((resolve) => httpServer.close(resolve));
    await new Promise((resolve) => watching.close(resolve));
    await rm(dir, { recursive: true, force: true });
    process.setSourceMapsEnabled(sourceMaps);
  });

  await firstRound;
  const url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
  return {
    dir,
    url,
    ssrDevServer,
    sendMessage,
    httpServer,
    async get(path) {
      const response = await fetch(`${url}${path}`, { redirect: 'manual' });
      return {
        status: response.status,
        body: await response.text(),
        location: response.headers.get('location'),
      };
    },
    edit(file, content, onInvalid) {
      const path = join(dir, file);
      return new Promise<void>((resolve, reject) => {
        // rspack's native watcher misses writes made before it subscribes,
        // which can be after the previous build is done.
        let retry: ReturnType<typeof setTimeout> | undefined;
        const write = () => {
          writeFile(path, content).catch(reject);
          retry = setTimeout(write, 1000);
        };
        edited = path;
        onEditInvalid = () => {
          clearTimeout(retry);
          onInvalid?.();
        };
        editDone = resolve;
        write();
      });
    },
    stallServerBuild() {
      let reach!: () => void;
      let release!: () => void;
      const reached = new Promise<void>((resolve) => (reach = resolve));
      const released = new Promise<void>((resolve) => (release = resolve));
      serverStall = { reach, released };
      return {
        reached,
        release() {
          serverStall = undefined;
          release();
        },
      };
    },
  };
}

// The part of connect the dev server relies on: `originalUrl`, `next(error)`
// and a final 404.
function runMiddlewares(
  middlewares: DevServerMiddleware[],
  req: IncomingMessage & { originalUrl?: string },
  res: ServerResponse
): void {
  req.originalUrl ??= req.url;
  let index = 0;
  const next = (error?: unknown) => {
    if (error) {
      res.statusCode = 500;
      res.end(`error: ${(error as Error).message}`);
      return;
    }
    const entry = middlewares[index++];
    if (!entry) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    const middleware = typeof entry === 'function' ? entry : entry.middleware;
    (middleware as (...args: unknown[]) => void)(req, res, next);
  };
  next();
}

describe('AngularSsrDevServer', () => {
  it.each([
    ['server', 'server.js', nodeHandler("'v2'"), 'v2'],
    [
      'browser',
      'browser.js',
      `console.log('PAGE-v2');\n`,
      // The server bundle reads the browser output when it loads.
      'v1 PAGE-v2',
    ],
  ])(
    'holds requests made during a %s rebuild until the server bundle of that edit loads',
    async (_, file, content, expected) => {
      const server = `
const main = require('node:fs').readFileSync(
  require('node:path').join(__dirname, '../browser/main.js'),
  'utf-8'
);
${nodeHandler(`'v1 ' + /PAGE-v\\d/.exec(main)[0]`)}`;
      const harness = await startHarness({
        server: file === 'server.js' ? undefined : server,
      });
      await harness.ssrDevServer?.firstLoad;

      let duringRebuild: ReturnType<Harness['get']> | undefined;
      await harness.edit(file, content, () => {
        duringRebuild = harness.get('/');
      });

      expect(JSON.parse((await duringRebuild!).body).body).toBe(expected);
    },
    20_000
  );

  it('answers 500 while the server bundle fails to load and serves the next good build', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const harness = await startHarness({
      server: `throw new Error('server.ts failed');`,
    });
    let loaded = false;
    harness.ssrDevServer?.firstLoad.then(() => (loaded = true));

    expect(await harness.get('/')).toMatchObject({
      status: 500,
      body: 'error: server.ts failed',
    });
    expect(error).toHaveBeenCalledTimes(1);
    expect(loaded).toBe(false);

    await harness.edit('server.js', nodeHandler("'fixed'"));
    await harness.ssrDevServer?.firstLoad;
    expect(JSON.parse((await harness.get('/')).body).body).toBe('fixed');
  }, 20_000);

  it.each([
    [
      'a request handler',
      `const handler = async (request) => new Response('web ' + new URL(request.url).pathname);
handler.__ng_request_handler__ = true;
exports.reqHandler = handler;`,
      { status: 200, body: 'web /a' },
      0,
    ],
    [
      'the application engine without a recognized reqHandler',
      `exports.ɵgetOrCreateAngularServerApp = () => ({
  handle: async (request) => new Response('engine ' + new URL(request.url).pathname),
});`,
      { status: 200, body: 'engine /a' },
      1,
    ],
    [
      'an error without a reqHandler or the application engine',
      `exports.other = 1;`,
      {
        status: 500,
        body: `error: The 'reqHandler' export in 'server.ts' is either undefined or does not provide a recognized request handler.`,
      },
      0,
    ],
  ])(
    'renders through %s',
    async (_, server, expected, warnings) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const harness = await startHarness({ server });
      await harness.get('/a');

      expect(await harness.get('/a')).toMatchObject(expected);
      expect(warn).toHaveBeenCalledTimes(warnings);
    },
    20_000
  );

  it.each([
    ['/app/a', 200, { url: '/a', originalUrl: '/app/a' }],
    ['/app/', 200, { url: '/', originalUrl: '/app/' }],
    // The dev middleware would answer it with the client-only document.
    ['/app/index.html', 200, { url: '/', originalUrl: '/app/index.html' }],
    ['/app/next', 404, undefined],
    ['/other', 404, undefined],
    ['/app', 404, undefined],
  ])(
    'routes %s under the serve path /app',
    async (path, status, rendered) => {
      const harness = await startHarness({ servePath: '/app' });

      const response = await harness.get(path);

      expect(response.status).toBe(status);
      if (rendered) {
        expect(JSON.parse(response.body)).toMatchObject(rendered);
      }
    },
    20_000
  );

  it.each(['/', '/index.html?x=1'])(
    'redirects %s to the serve path',
    async (path) => {
      const harness = await startHarness({ servePath: '/app' });

      expect(await harness.get(path)).toMatchObject({
        status: 302,
        location: path === '/' ? '/app/' : '/app/?x=1',
      });
    },
    20_000
  );

  it('leaves lazy compilation requests to the lazy compilation middleware', async () => {
    const harness = await startHarness({ lazyCompilation: true });

    expect((await harness.get('/_rspack/lazy/trigger__0')).status).toBe(404);
  }, 20_000);

  it.each(['/', '/app'])(
    'renders files that only the server build emitted under the serve path %s',
    async (servePath) => {
      const harness = await startHarness({ servePath, proxy: true });
      const base = servePath === '/' ? '' : servePath;

      expect(
        JSON.parse((await harness.get(`${base}/server.js`)).body)
      ).toMatchObject({ body: 'v1', url: '/server.js' });
      expect((await harness.get(`${base}/shared.txt`)).body).toBe(
        'browser shared'
      );
    },
    20_000
  );

  it('skips the render of a held GET or HEAD whose client left', async () => {
    const renders: string[] = [];
    const global = globalThis as { __ssrRenders?: string[] };
    global.__ssrRenders = renders;
    cleanups.push(async () => {
      delete global.__ssrRenders;
    });
    const harness = await startHarness({
      server: `
const handler = (req, res) => {
  globalThis.__ssrRenders.push(req.method);
  res.end();
};
handler.__ng_node_request_handler__ = true;
exports.reqHandler = handler;`,
    });
    const { release } = harness.stallServerBuild();
    const clients = new AbortController();
    const closed: Array<Promise<void>> = [];
    const arrived = new Promise<void>((resolve) =>
      harness.httpServer.on('request', (_req, res: ServerResponse) => {
        closed.push(new Promise((done) => res.once('close', () => done())));
        if (closed.length === 3) {
          resolve();
        }
      })
    );

    const round = harness.edit(
      'browser.js',
      `console.log('PAGE-v2');\n`,
      () => {
        for (const method of ['GET', 'HEAD', 'POST']) {
          fetch(harness.url, { method, signal: clients.signal }).catch(
            () => {}
          );
        }
      }
    );
    await arrived;
    clients.abort();
    await Promise.all(closed);
    release();
    await round;

    await vi.waitFor(() => expect(renders).toContain('POST'));
    expect(renders).toEqual(['POST']);
  }, 20_000);

  it('keeps Node source maps off while rspack builds unless a page renders', async () => {
    const render = { started: () => {}, finish: Promise.resolve() };
    const global = globalThis as { __ssrRender?: typeof render };
    global.__ssrRender = render;
    cleanups.push(async () => {
      delete global.__ssrRender;
    });
    const harness = await startHarness({
      server: `
const handler = async (req, res) => {
  globalThis.__ssrRender.started();
  await globalThis.__ssrRender.finish;
  res.end();
};
handler.__ng_node_request_handler__ = true;
exports.reqHandler = handler;`,
    });
    const states = [process.sourceMapsEnabled];

    let finishRender!: () => void;
    render.finish = new Promise((resolve) => (finishRender = resolve));
    const started = new Promise<void>((resolve) => (render.started = resolve));
    const page = harness.get('/');
    await started;
    const stall = harness.stallServerBuild();
    const round = harness.edit('browser.js', `console.log('PAGE-v2');\n`);
    await stall.reached;
    states.push(process.sourceMapsEnabled);
    finishRender();
    await page;
    states.push(process.sourceMapsEnabled);
    stall.release();
    await round;
    states.push(process.sourceMapsEnabled);

    // Idle, building while a page renders, building, idle.
    expect(states).toEqual([true, true, false, true]);
  }, 20_000);
});

describe('dev server reloads', () => {
  it.each([
    // The dev server's default, which angular-rspack keeps unless hmr is set.
    [
      'a server-only edit with hot on by default',
      'server.js',
      nodeHandler("'v2'"),
      {},
      1,
    ],
    // The client reloads on the hash change by itself.
    [
      'a server-only edit with hot off',
      'server.js',
      nodeHandler("'v2'"),
      { hot: false },
      0,
    ],
    ['a page edit', 'browser.js', `console.log('PAGE-v2');\n`, {}, 0],
    ['a document edit', 'document.html', '<p>v2</p>', {}, 1],
    [
      'a document edit without SSR',
      'document.html',
      '<p>v2</p>',
      { ssr: false },
      1,
    ],
    [
      'a server-only edit with live reload off',
      'server.js',
      nodeHandler("'v2'"),
      { liveReload: false },
      0,
    ],
    ['a compile error', 'server.js', 'exports.x = ;', {}, 0],
  ])(
    'counts the reloads the dev server misses after %s',
    async (_, file, content, options, reloads) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const harness = await startHarness(options);

      await harness.edit(file, content);

      expect(
        harness.sendMessage.mock.calls.filter(
          ([, type]) => type === 'static-changed'
        )
      ).toHaveLength(reloads);
    },
    20_000
  );
});
