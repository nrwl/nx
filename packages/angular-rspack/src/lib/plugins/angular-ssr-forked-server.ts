import type { Compiler, RspackPluginInstance } from '@rspack/core';
import { ChildProcess, fork } from 'node:child_process';
import { once } from 'node:events';
import { join } from 'node:path';
import type { NormalizedAngularRspackPluginOptions } from '../models';
import { servesSsrFromDevServer } from './angular-ssr-dev-server';
import type { SsrReloadServer } from './server/ssr-reload-server';

const PLUGIN_NAME = 'AngularSsrForkedServer';

export function servesSsrFromForkedServer(
  options: NormalizedAngularRspackPluginOptions
): boolean {
  return (
    options.hasServer &&
    typeof options.ssr === 'object' &&
    options.ssr.entry !== undefined &&
    !servesSsrFromDevServer(options)
  );
}

export class AngularSsrForkedServer implements RspackPluginInstance {
  #devServerProcess: ChildProcess | undefined;
  constructor(
    private readonly options: NormalizedAngularRspackPluginOptions,
    private readonly reloadServer?: SsrReloadServer
  ) {}

  apply(compiler: Compiler) {
    compiler.hooks.entryOption.tap(PLUGIN_NAME, (context, entry) => {
      const keys = Object.keys(entry);
      for (const key of keys) {
        const entryValue = entry[key];
        entryValue.import = [...entryValue.import];
      }
    });
    compiler.hooks.afterEmit.tapPromise(PLUGIN_NAME, async (compilation) => {
      if (!compiler.watchMode || compilation.errors.length) {
        return;
      }
      await this.#stopServer();

      this.#devServerProcess = fork(
        join(this.options.outputPath.server, 'server.js')
      );
      await once(this.#devServerProcess, 'spawn');
      this.reloadServer?.sendReload();
    });

    compiler.hooks.shutdown.tapPromise(PLUGIN_NAME, () => this.#stopServer());
  }

  async #stopServer() {
    const server = this.#devServerProcess;
    this.#devServerProcess = undefined;
    if (server && server.exitCode === null && server.signalCode === null) {
      const exited = once(server, 'exit');
      const forceStop = setTimeout(() => server.kill('SIGKILL'), 5000);
      forceStop.unref();
      try {
        server.kill();
        await exited;
      } finally {
        clearTimeout(forceStop);
      }
    }
  }
}
