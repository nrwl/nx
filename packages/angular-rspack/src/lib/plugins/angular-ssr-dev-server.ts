import { Compiler, RspackPluginInstance } from '@rspack/core';
import { ChildProcess, fork } from 'child_process';
import { SsrReloadServer } from './server/ssr-reload-server';

const PLUGIN_NAME = 'AngularSsrDevServer';
export class AngularSsrDevServer implements RspackPluginInstance {
  #devServerProcess: ChildProcess | undefined;
  #wsServer: SsrReloadServer;

  constructor() {
    this.#wsServer = new SsrReloadServer();
  }

  apply(compiler: Compiler) {
    compiler.hooks.entryOption.tap(PLUGIN_NAME, (context, entry) => {
      const keys = Object.keys(entry);
      for (const key of keys) {
        const entryValue = entry[key];
        entryValue.import = [
          ...entryValue.import,
          require.resolve(`${__dirname}/client/ssr-reload-client.js`),
        ];
      }
    });
    compiler.hooks.watchRun.tapAsync(
      PLUGIN_NAME,
      async (compiler, callback) => {
        compiler.hooks.afterEmit.tapAsync(PLUGIN_NAME, async (_, callback) => {
          const serverPath =
            compiler.options.output.path?.replace(
              'browser',
              'server/server.js'
            ) ?? 'dist/server/server.js';
          if (this.#devServerProcess) {
            this.#devServerProcess.kill();
            this.#devServerProcess = undefined;
            await new Promise<void>((res) => setTimeout(res, 50));
          }
          this.#devServerProcess = fork(serverPath);
          this.#devServerProcess.on('spawn', () => {
            this.#wsServer.sendReload();
          });
          callback();
        });
        callback();
      }
    );
  }
}
