import { NormalizedSchema } from './normalize-options';
import { getWorkspaceLayout, joinPathFragments, Tree } from '@nrwl/devkit';
import { dirname } from 'path';

let isOldNext: boolean;

try {
  require('next/dist/next-server/server/next-server');
  isOldNext = true;
} catch {
  isOldNext = false;
}

export function createNextServerFiles(host: Tree, options: NormalizedSchema) {
  if (options.server) {
    const directory = dirname(
      joinPathFragments(options.appProjectRoot, options.server)
    );

    host.write(
      joinPathFragments(options.appProjectRoot, options.server),
      `
      // @ts-check
      'use strict';

      /**
       * @typedef {import('http').Server} Server
       * @typedef {import('next/dist/server/next-server').default} DevServer
       */

      const express = require('express');

      /**
       * @param {DevServer} app
       * @param {{dev: string; dir: string; staticMarkup: boolean; quiet: boolean; conf: any; port: number;}} options
       * @returns {Promise<Server>}
       */
      module.exports = async function nextServer(app, options) {
        const handle = app.getRequestHandler();
        const expressApp = express();

        await app.prepare();

        /**
         * @returns {Promise<Server>}
         */
        return new Promise((resolve, reject) => {

          expressApp.all('*', (req, res) => {
            return handle(req, res);
          });

          const server = expressApp.listen(options.port, (err) => {
            err ? reject(err) : resolve(server);
          });
        });
      }
      `
    );
  }
}
