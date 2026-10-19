import type { Compiler, RspackPluginInstance } from '@rspack/core';
import { ChildProcess, fork } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { NormalizedAngularRspackPluginOptions } from '../models';
import { addBodyScript } from '../utils/index-file/add-body-script';
import { getIndexOutputFile } from '../utils/index-file/get-index-output-file';
import { connectSsrReload } from './client/ssr-reload-client';
import { SsrReloadServer } from './server/ssr-reload-server';

const PLUGIN_NAME = 'AngularSsrDevServer';

export class AngularSsrDevServer implements RspackPluginInstance {
  #devServerProcess: ChildProcess | undefined;
  #wsServer = new SsrReloadServer();

  constructor(private readonly options: NormalizedAngularRspackPluginOptions) {}

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
      await this.#attachSSRReloadClient();
      await this.#stopServer();

      this.#devServerProcess = fork(
        join(this.options.outputPath.server, 'server.js')
      );
      await once(this.#devServerProcess, 'spawn');
      this.#wsServer.sendReload();
    });

    compiler.hooks.shutdown.tapPromise(PLUGIN_NAME, async () => {
      try {
        await this.#stopServer();
      } finally {
        await this.#wsServer.close();
      }
    });
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

  async #attachSSRReloadClient() {
    const port = await this.#wsServer.getPort();
    const pathToIndex = join(
      this.options.outputPath.browser,
      getIndexOutputFile(this.options.index)
    );
    const html = readFileSync(pathToIndex, 'utf-8').replace(
      /<script id="nx-angular-ssr-reload"[^>]*>[\s\S]*?<\/script>/g,
      ''
    );
    const updatedHtml = await addBodyScript(
      html,
      `(${connectSsrReload.toString()})(${port});`,
      'nx-angular-ssr-reload'
    );
    writeFileSync(pathToIndex, updatedHtml);
  }
}
