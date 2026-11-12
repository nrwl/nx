import type {
  Compilation,
  Compiler,
  DevServer,
  DevServerMiddlewareHandler,
  DevServerMiddlewareObject,
} from '@rspack/core';
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join, resolve, sep } from 'node:path';
import { finished } from 'node:stream';
import * as tls from 'node:tls';
import { pathToFileURL } from 'node:url';
import type { NormalizedAngularRspackPluginOptions } from '../models';
import { getIndexOutputFile } from '../utils/index-file/get-index-output-file';
import { loadEsmModule } from '../utils/misc-helpers';
import { isRspackV2 } from '../utils/rspack-version';
import type { DevServerReloads } from './dev-server-reloads';

type NodeRequest = IncomingMessage & { originalUrl?: string };
type Next = (error?: unknown) => void;
type NodeRequestHandler = (
  req: NodeRequest,
  res: ServerResponse,
  next: Next
) => unknown;
type WebRequestHandler = (
  request: Request
) => Promise<Response | null> | Response | null;

interface ServerBundle {
  reqHandler?: unknown;
  ɵgetOrCreateAngularServerApp?: (options: {
    allowStaticRouteRender: boolean;
  }) => { handle(request: Request): Promise<Response | null> };
  ɵdestroyAngularServerApp?: () => void;
}

interface NodeHelpers {
  createWebRequestFromNodeRequest(request: IncomingMessage): Request;
  writeResponseToNodeResponse(
    source: Response,
    destination: ServerResponse
  ): Promise<void>;
}

interface Deferred {
  promise: Promise<void>;
  resolve(): void;
}

const PLUGIN_NAME = 'AngularSsrDevServer';
const DEV_MIDDLEWARE_NAMES = new Set([
  '@rspack/dev-middleware',
  'webpack-dev-middleware',
]);
const LAZY_COMPILATION_PREFIXES = {
  v2: '/_rspack/lazy/trigger',
  v1: '/lazy-compilation-using-',
};

export function servesSsrFromDevServer(
  options: NormalizedAngularRspackPluginOptions
): boolean {
  return (
    options.hasServer &&
    typeof options.ssr === 'object' &&
    options.ssr.entry !== undefined
  );
}

/**
 * Serves SSR from the dev server's own URL: a middleware in the dev-server
 * process requires the server bundle and calls the `reqHandler` that the
 * server entry exports, as `@angular/build` does for `ng serve`.
 */
export class AngularSsrDevServer {
  readonly firstLoad: Promise<void>;
  readonly #options: NormalizedAngularRspackPluginOptions;
  readonly #reloads: DevServerReloads | undefined;
  readonly #serverFile: string;
  readonly #indexFile: string;
  readonly #resolveFirstLoad: () => void;
  #base = '/';
  #lazyCompilationPrefix: string | undefined;
  // Open until the server bundle matching the latest edit is loaded.
  #gate: Deferred | undefined = deferred();
  #browserBusy = false;
  #browserBuilds = 0;
  #browserHasErrors = false;
  #serverRunBrowserBuilds = -1;
  #browserFiles = new Set<string>();
  #serverFiles: Set<string> | undefined;
  #bundle: ServerBundle | undefined;
  #loadError: unknown;
  #nodeHelpers: Promise<NodeHelpers> | undefined;
  #fallbackWarningShown = false;
  // False when the user turned on Node source maps, which then stay on.
  readonly #switchesSourceMaps = !process.sourceMapsEnabled;
  #turnedSourceMapsOn = false;
  #rendering = 0;

  constructor(
    options: NormalizedAngularRspackPluginOptions,
    reloads?: DevServerReloads
  ) {
    this.#options = options;
    this.#reloads = reloads;
    this.#serverFile = join(options.outputPath.server, 'server.js');
    this.#indexFile = options.index
      ? getIndexOutputFile(options.index)
      : 'index.html';
    const firstLoad = deferred();
    this.firstLoad = firstLoad.promise;
    this.#resolveFirstLoad = firstLoad.resolve;
  }

  applyToBrowser(compiler: Compiler): void {
    const devServer = compiler.options.devServer;
    if (devServer) {
      this.#addMiddlewares(devServer);
    }
    this.#lazyCompilationPrefix = getLazyCompilationPrefix(compiler);

    compiler.hooks.invalid.tap(PLUGIN_NAME, () => this.#onBrowserChange());
    compiler.hooks.watchRun.tap(PLUGIN_NAME, () => this.#onBrowserChange());
    compiler.hooks.done.tap(PLUGIN_NAME, (stats) => {
      this.#browserBusy = false;
      this.#browserBuilds++;
      this.#browserHasErrors = stats.hasErrors();
      this.#browserFiles = getAssetNames(stats.compilation);
    });
    compiler.hooks.failed.tap(PLUGIN_NAME, () => {
      this.#browserBusy = false;
      this.#closeGate();
    });
  }

  applyToServer(compiler: Compiler): void {
    this.#openInspector(compiler);
    this.#trustCustomCertificate();
    this.#reloads?.trackEmits('server', compiler);

    compiler.hooks.invalid.tap(PLUGIN_NAME, () => this.#openGate());
    compiler.hooks.watchRun.tap(PLUGIN_NAME, () => {
      this.#openGate();
      this.#serverRunBrowserBuilds = this.#browserBuilds;
    });
    compiler.hooks.done.tap(PLUGIN_NAME, (stats) => {
      this.#reloads?.record('server', stats.compilation);
      this.#serverFiles = getAssetNames(stats.compilation);
      // rspack re-runs the server after a browser build that finished, or
      // started, after this run began.
      if (
        this.#browserBusy ||
        this.#serverRunBrowserBuilds !== this.#browserBuilds
      ) {
        return;
      }
      if (!stats.hasErrors() && !this.#browserHasErrors) {
        this.#load();
      }
      this.#reloads?.endRound();
      this.#closeGate();
    });
    compiler.hooks.failed.tap(PLUGIN_NAME, () => this.#closeGate());
  }

  #onBrowserChange(): void {
    this.#browserBusy = true;
    this.#openGate();
  }

  #openGate(): void {
    this.#gate ??= deferred();
    this.#syncSourceMaps();
  }

  #closeGate(): void {
    this.#gate?.resolve();
    this.#gate = undefined;
    this.#syncSourceMaps();
  }

  // zone.js in the bundle reads the stack of rejected promises in the whole
  // process, rspack's included, and mapping those stacks slows every build.
  #syncSourceMaps(): void {
    if (this.#switchesSourceMaps && this.#turnedSourceMapsOn) {
      process.setSourceMapsEnabled(!this.#gate || this.#rendering > 0);
    }
  }

  #addMiddlewares(devServer: DevServer): void {
    const setupMiddlewares = devServer.setupMiddlewares;
    devServer.setupMiddlewares = (middlewares, server) => {
      const result = setupMiddlewares
        ? setupMiddlewares(middlewares, server)
        : middlewares;
      const publicPath = devServer.devMiddleware?.publicPath;
      this.#base =
        typeof publicPath === 'string' && publicPath !== '/'
          ? `${publicPath.replace(/\/$/, '')}/`
          : '/';
      const isDevMiddleware = (
        entry: (typeof result)[number]
      ): entry is DevServerMiddlewareObject =>
        typeof entry === 'object' && DEV_MIDDLEWARE_NAMES.has(entry.name ?? '');
      const first = result.findIndex(isDevMiddleware);
      if (first !== -1) {
        // The dev server adds the dev middleware again after a proxy and
        // after historyApiFallback.
        result.forEach((entry, index) => {
          if (isDevMiddleware(entry)) {
            result[index] = this.#skipServerOnlyFiles(entry);
          }
        });
        result.splice(first, 0, {
          name: 'angular-ssr-index',
          middleware: this.#routeIndexToSsr,
        });
      }
      result.push({ name: 'angular-ssr', middleware: this.#middleware });
      return result;
    };
  }

  // Bypass the client-only index without changing `originalUrl`, which
  // Angular's request adapter uses for SSR routing.
  readonly #routeIndexToSsr = (
    req: NodeRequest,
    _res: ServerResponse,
    next: Next
  ): void => {
    const { pathname, search } = new URL(req.url ?? '/', 'http://localhost');
    if (pathname === `${this.#base}${this.#indexFile}`) {
      req.originalUrl ??= req.url;
      req.url = `${this.#base}${search}`;
    }
    next();
  };

  // rspack 1.x's dev middleware also serves the server compilation's files,
  // which `ng serve` and rspack 2 send to SSR.
  #skipServerOnlyFiles(
    entry: DevServerMiddlewareObject
  ): DevServerMiddlewareObject {
    const wrap = (
      devMiddleware: DevServerMiddlewareObject['middleware']
    ): DevServerMiddlewareObject['middleware'] => {
      if (!devMiddleware) {
        return devMiddleware;
      }
      const handle: DevServerMiddlewareHandler = (req, res, next) =>
        this.#isServerOnlyFile(req.url)
          ? next()
          : (devMiddleware as DevServerMiddlewareHandler)(req, res, next);
      return (req, res, next) => {
        // The first server build lists its files.
        const gate = this.#serverFiles ? undefined : this.#gate?.promise;
        if (!gate) {
          return handle(req, res, next);
        }
        return gate.then(() => handle(req, res, next)).catch(next);
      };
    };
    let middleware = wrap(entry.middleware);
    // The dev server creates its dev middleware after `setupMiddlewares`, and
    // only for the entries whose middleware is still undefined.
    return {
      ...entry,
      get middleware() {
        return middleware;
      },
      set middleware(devMiddleware) {
        middleware = wrap(devMiddleware);
      },
    };
  }

  #isServerOnlyFile(url = '/'): boolean {
    const { pathname } = new URL(url, 'http://localhost');
    if (!this.#serverFiles || !pathname.startsWith(this.#base)) {
      return false;
    }
    let name: string;
    try {
      name = decodeURIComponent(pathname.slice(this.#base.length));
    } catch {
      return false;
    }
    return this.#serverFiles.has(name) && !this.#browserFiles.has(name);
  }

  readonly #middleware = (
    req: NodeRequest,
    res: ServerResponse,
    next: Next
  ): void => {
    this.#handle(req, res, next).catch(next);
  };

  async #handle(
    req: NodeRequest,
    res: ServerResponse,
    next: Next
  ): Promise<void> {
    const url = req.url ?? '/';
    if (
      this.#lazyCompilationPrefix &&
      url.startsWith(this.#lazyCompilationPrefix)
    ) {
      next();
      return;
    }
    if (this.#base !== '/') {
      if (!url.startsWith(this.#base)) {
        const { pathname, search, hash } = new URL(url, 'http://localhost');
        if (pathname === '/' || pathname === '/index.html') {
          res.writeHead(302, { Location: `${this.#base}${search}${hash}` });
          res.end();
        } else {
          next();
        }
        return;
      }
      req.originalUrl ??= url;
      req.url = url === this.#base ? '/' : url.slice(this.#base.length - 1);
    }

    await this.#gate?.promise;
    // @angular/ssr would abort the render and log an AbortError.
    if ((req.method === 'GET' || req.method === 'HEAD') && res.destroyed) {
      return;
    }
    this.#rendering++;
    this.#syncSourceMaps();
    finished(res, () => {
      this.#rendering--;
      this.#syncSourceMaps();
    });
    const bundle = this.#bundle;
    if (!bundle) {
      throw (
        this.#loadError ??
        new Error(
          'The server bundle failed to build. Fix the errors the dev server reports to render this page.'
        )
      );
    }

    const { reqHandler } = bundle;
    if (isNodeRequestHandler(reqHandler)) {
      await reqHandler(req, res, next);
      return;
    }
    if (isWebRequestHandler(reqHandler)) {
      const helpers = await this.#loadNodeHelpers();
      const response = await reqHandler(
        helpers.createWebRequestFromNodeRequest(req)
      );
      if (!response) {
        next();
        return;
      }
      await helpers.writeResponseToNodeResponse(response, res);
      return;
    }

    const getOrCreateApp = bundle.ɵgetOrCreateAngularServerApp;
    if (!getOrCreateApp) {
      throw new Error(
        `The 'reqHandler' export in 'server.ts' is either undefined or does not provide a recognized request handler.`
      );
    }
    if (!this.#fallbackWarningShown) {
      console.warn(
        `The 'reqHandler' export in 'server.ts' is either undefined or does not provide a recognized request handler. ` +
          'Using the internal SSR middleware instead.'
      );
      this.#fallbackWarningShown = true;
    }
    const helpers = await this.#loadNodeHelpers();
    const response = await getOrCreateApp({
      allowStaticRouteRender: true,
    }).handle(
      new Request(helpers.createWebRequestFromNodeRequest(req), {
        signal: AbortSignal.timeout(30_000),
      })
    );
    if (!response) {
      next();
      return;
    }
    await helpers.writeResponseToNodeResponse(response, res);
  }

  #load(): void {
    // Node reads a module's source map only if maps are on when it loads.
    process.setSourceMapsEnabled(true);
    this.#turnedSourceMapsOn = true;
    const requireBundle = createRequire(this.#serverFile);
    try {
      // Drop the previous bundle and its chunks, or every load keeps them.
      const serverDir = dirname(requireBundle.resolve(this.#serverFile)) + sep;
      for (const id of Object.keys(requireBundle.cache)) {
        if (id.startsWith(serverDir)) {
          delete requireBundle.cache[id];
        }
      }
      const bundle: ServerBundle = requireBundle(this.#serverFile);
      // A shared (external) @angular/ssr would otherwise keep serving the
      // previous bundle's application.
      bundle.ɵdestroyAngularServerApp?.();
      this.#bundle = bundle;
      this.#loadError = undefined;
      this.#resolveFirstLoad();
    } catch (error) {
      this.#bundle = undefined;
      this.#loadError = error;
      console.error(error);
    }
  }

  #loadNodeHelpers(): Promise<NodeHelpers> {
    this.#nodeHelpers ??= (async () => {
      // @angular/ssr/node imports Angular packages that are linked at
      // runtime, which needs the compiler.
      await loadEsmModule(this.#resolveFromRoot('@angular/compiler'));
      return loadEsmModule<NodeHelpers>(
        this.#resolveFromRoot('@angular/ssr/node')
      );
    })();
    return this.#nodeHelpers;
  }

  #resolveFromRoot(request: string): URL {
    return pathToFileURL(
      require.resolve(request, { paths: [this.#options.root] })
    );
  }

  #openInspector(compiler: Compiler): void {
    const inspect = parseInspect(this.#options.devServer.inspect);
    if (!inspect) {
      return;
    }
    const inspector =
      require('node:inspector') as typeof import('node:inspector');
    inspector.open(inspect.port, inspect.host, true);
    compiler.hooks.shutdown.tap(PLUGIN_NAME, () => inspector.close());
  }

  // Server-side requests to the dev server's own https URL must trust its
  // certificate, as they do under `ng serve`.
  #trustCustomCertificate(): void {
    const { ssl, sslCert, sslKey } = this.#options.devServer;
    if (
      !ssl ||
      !sslCert ||
      !sslKey ||
      typeof tls.setDefaultCACertificates !== 'function'
    ) {
      return;
    }
    tls.setDefaultCACertificates([
      ...tls.getCACertificates('default'),
      readFileSync(resolve(this.#options.root, sslCert), 'utf-8'),
    ]);
  }
}

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

function getAssetNames(compilation: Compilation): Set<string> {
  return new Set(compilation.getAssets().map((asset) => asset.name));
}

function isNodeRequestHandler(value: unknown): value is NodeRequestHandler {
  return typeof value === 'function' && '__ng_node_request_handler__' in value;
}

function isWebRequestHandler(value: unknown): value is WebRequestHandler {
  return typeof value === 'function' && '__ng_request_handler__' in value;
}

function getLazyCompilationPrefix(compiler: Compiler): string | undefined {
  const isV2 = isRspackV2();
  const options = compiler.options as {
    lazyCompilation?: unknown;
    experiments?: { lazyCompilation?: unknown };
  };
  // rspack 1.x still reads experiments.lazyCompilation, below the top-level option.
  const enabled = [
    options.lazyCompilation,
    isV2 ? undefined : options.experiments?.lazyCompilation,
  ].filter(Boolean);
  if (!enabled.length) {
    return undefined;
  }
  const prefix = enabled
    .map((option) =>
      typeof option === 'object' &&
      option !== null &&
      'prefix' in option &&
      typeof option.prefix === 'string'
        ? option.prefix
        : undefined
    )
    .find(Boolean);
  return (
    prefix ??
    (isV2 ? LAZY_COMPILATION_PREFIXES.v2 : LAZY_COMPILATION_PREFIXES.v1)
  );
}

/** The `@angular/build` dev-server parsing of its `inspect` option. */
export function parseInspect(
  inspect: string | boolean | undefined
): { host?: string; port?: number } | undefined {
  if (inspect === true || inspect === '' || inspect === 'true') {
    return {};
  }
  if (typeof inspect !== 'string' || inspect === 'false') {
    return undefined;
  }
  const port = +inspect;
  if (isFinite(port)) {
    return { port };
  }
  const [host, hostPort] = inspect.split(':');
  return { host, port: isNaN(+hostPort) ? undefined : +hostPort };
}
