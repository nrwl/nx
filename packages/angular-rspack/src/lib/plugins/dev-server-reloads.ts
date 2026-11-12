import type { Compilation, Compiler } from '@rspack/core';
import { createHash } from 'node:crypto';

type CompilerKind = 'browser' | 'server';

interface DevServerInstance {
  webSocketServer?: { clients: unknown[] } | null;
  sendMessage(clients: unknown[], type: string): void;
}

const PLUGIN_NAME = 'DevServerReloads';

/**
 * Sends the dev server's `static-changed` message, which makes its client
 * reload the page, for the changes its hot client leaves alone: server-only
 * edits and browser outputs outside the page's chunks (documents, copied
 * files, web workers). Without hot, the client reloads by itself whenever the
 * compilation hash changes, which every output change does.
 */
export class DevServerReloads {
  readonly #outputs = new Map<CompilerKind, Map<string, string>>();
  readonly #emitted: Record<CompilerKind, Set<string>> = {
    browser: new Set(),
    server: new Set(),
  };
  #liveReload = false;
  #hot = false;
  #devServer: DevServerInstance | undefined;
  #roundEnded = false;
  #hasErrors = false;
  #pageChanged = false;
  #otherBrowserChanged = false;
  #serverChanged = false;

  /**
   * Taps the browser compiler. Without an SSR server its build ends the
   * round; otherwise the server build does.
   */
  apply(compiler: Compiler, { endsRound }: { endsRound: boolean }): void {
    const devServer = compiler.options.devServer;
    // The dev server turns both on unless they are set to false.
    if (!devServer || devServer.liveReload === false) {
      return;
    }
    this.#liveReload = true;
    this.#hot = devServer.hot !== false;
    const setupMiddlewares = devServer.setupMiddlewares;
    devServer.setupMiddlewares = (middlewares, server) => {
      this.#devServer = server;
      return setupMiddlewares
        ? setupMiddlewares(middlewares, server)
        : middlewares;
    };
    this.trackEmits('browser', compiler);
    compiler.hooks.done.tap(PLUGIN_NAME, (stats) => {
      this.record('browser', stats.compilation);
      if (endsRound) {
        this.endRound();
      }
    });
  }

  /**
   * Lists the files a build emits, so `record` reads only those. rspack
   * doesn't emit the assets it keeps from the previous build.
   */
  trackEmits(kind: CompilerKind, compiler: Compiler): void {
    compiler.hooks.assetEmitted.tap(PLUGIN_NAME, (file) => {
      if (this.#liveReload) {
        this.#emitted[kind].add(file);
      }
    });
  }

  record(kind: CompilerKind, compilation: Compilation): void {
    if (!this.#liveReload) {
      return;
    }
    const emitted = this.#emitted[kind];
    if (compilation.errors.length) {
      this.#hasErrors = true;
    }
    const previous = this.#outputs.get(kind);
    const current = new Map<string, string>();
    const browserFiles =
      kind === 'browser' ? classifyBrowserFiles(compilation) : undefined;
    for (const asset of compilation.getAssets()) {
      if (asset.name.endsWith('.map') || asset.name.includes('.hot-update.')) {
        continue;
      }
      const known = previous?.get(asset.name);
      const digest =
        known !== undefined && !emitted.has(asset.name)
          ? known
          : createHash('sha1').update(asset.source.buffer()).digest('hex');
      current.set(asset.name, digest);
      if (!previous || known === digest) {
        continue;
      }
      if (!browserFiles) {
        this.#serverChanged = true;
      } else if (browserFiles.page.has(asset.name)) {
        this.#pageChanged = true;
      } else if (!browserFiles.runtime.has(asset.name)) {
        this.#otherBrowserChanged = true;
      }
    }
    this.#outputs.set(kind, current);
    emitted.clear();
  }

  /** Decides on the changes recorded since the previous round ended. */
  endRound(): void {
    if (!this.#liveReload) {
      return;
    }
    // The hot client applies page changes, or reloads when it can't. A server
    // change that comes with them shows on that reload or the next request.
    const reload =
      this.#roundEnded &&
      this.#hot &&
      !this.#hasErrors &&
      (this.#otherBrowserChanged ||
        (this.#serverChanged && !this.#pageChanged));
    this.#roundEnded = true;
    this.#hasErrors = false;
    this.#pageChanged = false;
    this.#otherBrowserChanged = false;
    this.#serverChanged = false;

    const clients = this.#devServer?.webSocketServer?.clients;
    if (reload && clients) {
      this.#devServer?.sendMessage(clients, 'static-changed');
    }
  }
}

/**
 * Splits the files of the page's runtimes into the ones the hot client
 * updates and the runtime chunks, which change with the compilation hash on
 * every rebuild. Files of other runtimes (web workers) are in neither set.
 */
function classifyBrowserFiles(compilation: Compilation): {
  page: Set<string>;
  runtime: Set<string>;
} {
  const pageRuntimes = new Set<string>();
  for (const entrypoint of compilation.entrypoints.values()) {
    for (const chunk of entrypoint.chunks) {
      chunk.runtime.forEach((runtime) => pageRuntimes.add(runtime));
    }
  }
  const page = new Set<string>();
  const runtime = new Set<string>();
  for (const chunk of compilation.chunks) {
    if (![...chunk.runtime].every((name) => pageRuntimes.has(name))) {
      continue;
    }
    const files =
      chunk.hasRuntime() &&
      compilation.chunkGraph.getChunkModules(chunk).length === 0
        ? runtime
        : page;
    chunk.files.forEach((file) => files.add(file));
    chunk.auxiliaryFiles.forEach((file) => files.add(file));
  }
  return { page, runtime };
}
