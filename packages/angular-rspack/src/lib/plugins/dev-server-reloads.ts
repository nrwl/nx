import type { Compilation, Compiler } from '@rspack/core';
import { createHash } from 'node:crypto';

interface DevServerInstance {
  webSocketServer?: { clients: unknown[] } | null;
  sendMessage(clients: unknown[], type: string): void;
}

const PLUGIN_NAME = 'DevServerReloads';

/**
 * Sends the dev server's `static-changed` message, which makes its client
 * reload the page, for the browser outputs its hot client leaves alone:
 * documents, copied files and web workers. Without hot, the client reloads by
 * itself whenever the compilation hash changes, which every output change does.
 */
export class DevServerReloads {
  #outputs: Map<string, string> | undefined;
  readonly #emitted = new Set<string>();
  #devServer: DevServerInstance | undefined;

  /** Taps the browser compiler. */
  apply(compiler: Compiler): void {
    const devServer = compiler.options.devServer;
    // The dev server turns both on unless they are set to false.
    if (
      !devServer ||
      devServer.liveReload === false ||
      devServer.hot === false
    ) {
      return;
    }
    const setupMiddlewares = devServer.setupMiddlewares;
    devServer.setupMiddlewares = (middlewares, server) => {
      this.#devServer = server;
      return setupMiddlewares
        ? setupMiddlewares(middlewares, server)
        : middlewares;
    };
    // Lists the files a build emits, so `#record` reads only those. rspack
    // doesn't emit the assets it keeps from the previous build.
    compiler.hooks.assetEmitted.tap(PLUGIN_NAME, (file) => {
      this.#emitted.add(file);
    });
    compiler.hooks.done.tap(PLUGIN_NAME, (stats) => {
      // The hot client applies page changes, or reloads when it can't.
      const reload =
        this.#record(stats.compilation) && !stats.compilation.errors.length;
      const clients = this.#devServer?.webSocketServer?.clients;
      if (reload && clients) {
        this.#devServer?.sendMessage(clients, 'static-changed');
      }
    });
  }

  /** Whether a browser output outside the page's chunks changed. */
  #record(compilation: Compilation): boolean {
    const previous = this.#outputs;
    const current = new Map<string, string>();
    const browserFiles = classifyBrowserFiles(compilation);
    let otherChanged = false;
    for (const asset of compilation.getAssets()) {
      if (asset.name.endsWith('.map') || asset.name.includes('.hot-update.')) {
        continue;
      }
      const known = previous?.get(asset.name);
      const digest =
        known !== undefined && !this.#emitted.has(asset.name)
          ? known
          : createHash('sha1').update(asset.source.buffer()).digest('hex');
      current.set(asset.name, digest);
      if (
        previous &&
        known !== digest &&
        !browserFiles.page.has(asset.name) &&
        !browserFiles.runtime.has(asset.name)
      ) {
        otherChanged = true;
      }
    }
    this.#outputs = current;
    this.#emitted.clear();
    return otherChanged;
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
