import {
  Compilation,
  Compiler,
  RspackPluginInstance,
  sources,
} from '@rspack/core';
import { ChildProcess, fork } from 'child_process';
import { SsrReloadServer } from './server/ssr-reload-server';
import { NormalizedAngularRspackPluginOptions } from '../models';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { getIndexOutputFile } from '../utils/index-file/get-index-output-file';
import { addBodyScript } from '../utils/index-file/add-body-script';

const PLUGIN_NAME = 'AngularSsrDevServer';

export class AngularSsrDevServer implements RspackPluginInstance {
  #devServerProcess: ChildProcess | undefined;
  #wsServer: SsrReloadServer;
  #options: NormalizedAngularRspackPluginOptions;

  constructor(options: NormalizedAngularRspackPluginOptions) {
    this.#wsServer = new SsrReloadServer();
    this.#options = options;
  }

  apply(compiler: Compiler) {
    compiler.hooks.entryOption.tap(PLUGIN_NAME, (context, entry) => {
      const keys = Object.keys(entry);
      for (const key of keys) {
        const entryValue = entry[key];
        entryValue.import = [...entryValue.import];
      }
    });
    compiler.hooks.watchRun.tapAsync(
      PLUGIN_NAME,
      async (compiler, callback) => {
        compiler.hooks.afterEmit.tapAsync(
          PLUGIN_NAME,
          async (compilation, callback) => {
            await this.#attachSSRReloadClient(compilation);

            const serverPath = join(
              this.#options.outputPath.server,
              'server.js'
            );
            if (this.#devServerProcess) {
              this.#devServerProcess.kill();
              this.#devServerProcess = undefined;
              await new Promise<void>((res) => setTimeout(res, 50));
            }
            if (!existsSync(serverPath)) {
              await new Promise<void>((res) => setTimeout(res, 50));
            }
            this.#devServerProcess = fork(serverPath);
            this.#devServerProcess.on('spawn', () => {
              this.#wsServer.sendReload();
            });
            callback();
          }
        );
        callback();
      }
    );
  }

  async #attachSSRReloadClient(compilation: Compilation) {
    const clientPath = require.resolve(
      `${__dirname}/client/ssr-reload-client.js`
    );
    const pathToIndex = join(
      this.#options.outputPath.browser,
      getIndexOutputFile(this.#options.index)
    );
    const html = readFileSync(pathToIndex, 'utf-8');
    const updatedHtml = await addBodyScript(
      html,
      readFileSync(clientPath, 'utf-8')
    );
    const source = new sources.RawSource(updatedHtml);

    const relativePathToIndex = pathToIndex.replace(
      this.#options.outputPath.browser,
      ''
    );
    compilation.emitAsset(relativePathToIndex, source);
  }
}
